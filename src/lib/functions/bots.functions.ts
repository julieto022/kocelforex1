import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BOT_STATUSES } from "@/lib/api/constants";
import { invalid, toBotApiError } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { recordAudit } from "@/lib/server/audit.server";
import { pushNotification } from "@/lib/server/notify.server";
import { requireConnectionOwnership, requireOwnership } from "@/lib/server/ownership.server";

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  symbol: z.string().trim().min(2).max(64),
  riskProfile: z.enum(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"]),
  timeframe: z.string().trim().min(1).max(10),
  brokerConnectionId: z.string().uuid(),
  strategyId: z.string().uuid(),
  configuration: z.record(z.string(), z.unknown()).default({}),
});

function logBotDatabaseError(
  operation: string,
  userId: string,
  error: unknown,
  payloadKeys?: string[],
) {
  const databaseError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
    status?: number;
  };
  logger.error("database", "Bot operation failed", {
    operation,
    table: "bots",
    userId,
    code: databaseError.code,
    message: databaseError.message,
    details: databaseError.details,
    hint: databaseError.hint,
    status: databaseError.status,
    payloadKeys,
  });
}

export const createBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireConnectionOwnership(supabase, data.brokerConnectionId, userId);

    const { data: strategy, error: strategyError } = await supabase
      .from("strategies")
      .select("id")
      .eq("id", data.strategyId)
      .eq("is_active", true)
      .maybeSingle();
    if (strategyError) {
      logBotDatabaseError("strategies.select", userId, strategyError, ["id", "is_active"]);
      throw toBotApiError(strategyError);
    }
    if (!strategy) throw invalid("This strategy is not available.");

    const { data: row, error } = await supabase
      .from("bots")
      .insert({
        user_id: userId,
        name: data.name,
        symbol: data.symbol.trim(),
        risk_profile: data.riskProfile,
        timeframe: data.timeframe ?? null,
        broker_connection_id: data.brokerConnectionId ?? null,
        strategy_id: data.strategyId ?? null,
        status: "STOPPED",
        configuration: data.configuration as never,
      })
      .select("*")
      .single();
    if (error) {
      logBotDatabaseError("bots.insert", userId, error, [
        "user_id",
        "name",
        "symbol",
        "risk_profile",
        "timeframe",
        "broker_connection_id",
        "strategy_id",
        "status",
        "configuration",
      ]);
      throw toBotApiError(error);
    }

    await recordAudit({ userId, action: "BOT_CREATED", entityType: "bot", entityId: row.id });
    return row;
  });

const updateSchema = z.object({
  botId: z.string().uuid(),
  name: z.string().trim().min(2).max(60).optional(),
  symbol: z.string().trim().min(2).max(64).optional(),
  timeframe: z.string().trim().max(10).nullish(),
  riskProfile: z.enum(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"]).optional(),
  strategyId: z.string().uuid().nullable().optional(),
  brokerConnectionId: z.string().uuid().nullable().optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
});

export const updateBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOwnership(supabase, "bots", data.botId, userId);

    if (data.brokerConnectionId !== undefined) {
      await requireConnectionOwnership(supabase, data.brokerConnectionId, userId);
    }
    if (data.strategyId !== undefined && data.strategyId !== null) {
      const { data: strategy, error: strategyError } = await supabase
        .from("strategies")
        .select("id")
        .eq("id", data.strategyId)
        .eq("is_active", true)
        .maybeSingle();
      if (strategyError) {
        logBotDatabaseError("strategies.select", userId, strategyError, ["id", "is_active"]);
        throw toBotApiError(strategyError);
      }
      if (!strategy) throw invalid("This strategy is not available.");
    }

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch["name"] = data.name;
    if (data.symbol !== undefined) patch["symbol"] = data.symbol.trim();
    if (data.timeframe !== undefined) patch["timeframe"] = data.timeframe;
    if (data.riskProfile !== undefined) patch["risk_profile"] = data.riskProfile;
    if (data.strategyId !== undefined) patch["strategy_id"] = data.strategyId;
    if (data.brokerConnectionId !== undefined) patch["broker_connection_id"] = data.brokerConnectionId;
    if (data.configuration !== undefined) patch["configuration"] = data.configuration;
    if (Object.keys(patch).length === 0) throw invalid("Nothing to update.");

    const { error } = await supabase
      .from("bots")
      .update(patch as never)
      .eq("id", data.botId);
    if (error) {
      logBotDatabaseError("bots.update", userId, error, Object.keys(patch));
      throw toBotApiError(error);
    }

    await recordAudit({ userId, action: "BOT_UPDATED", entityType: "bot", entityId: data.botId });
    return { ok: true as const };
  });

const statusSchema = z.object({
  botId: z.string().uuid(),
  status: z.enum(BOT_STATUSES),
});

/**
 * Records the requested run-state. Actual execution happens in the Bridge EA,
 * so a bot without a connected account can only ever reach WAITING.
 */
export const setBotStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => statusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOwnership(supabase, "bots", data.botId, userId);

    const { data: bot, error: readError } = await supabase
      .from("bots")
      .select("id, name, broker_connection_id, broker_connections:broker_connection_id(status)")
      .eq("id", data.botId)
      .single();
    if (readError) {
      logBotDatabaseError("bots.status.read", userId, readError, ["id", "name", "broker_connection_id"]);
      throw toBotApiError(readError);
    }

    const connected =
      (bot as unknown as { broker_connections: { status: string } | null }).broker_connections
        ?.status === "CONNECTED";
    const status = data.status === "RUNNING" && !connected ? "WAITING" : data.status;

    const { error } = await supabase.from("bots").update({ status }).eq("id", data.botId);
    if (error) {
      logBotDatabaseError("bots.status.update", userId, error, ["status"]);
      throw toBotApiError(error);
    }

    await recordAudit({
      userId,
      action: "BOT_STATE_CHANGED",
      entityType: "bot",
      entityId: data.botId,
      metadata: { status },
    });
    await pushNotification({
      userId,
      type: "BOT_UPDATE",
      title: `${bot.name} is now ${status.toLowerCase()}`,
      entityType: "bot",
      entityId: data.botId,
    });
    return { status };
  });

export const deleteBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ botId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOwnership(supabase, "bots", data.botId, userId);
    const { error } = await supabase.from("bots").delete().eq("id", data.botId);
    if (error) {
      logBotDatabaseError("bots.delete", userId, error, ["botId"]);
      throw toBotApiError(error);
    }
    await recordAudit({ userId, action: "BOT_DELETED", entityType: "bot", entityId: data.botId });
    return { ok: true as const };
  });
