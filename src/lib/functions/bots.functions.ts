import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BOT_STATUSES } from "@/lib/api/constants";
import { invalid, toApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/server/audit.server";
import { pushNotification } from "@/lib/server/notify.server";
import { requireConnectionOwnership, requireOwnership } from "@/lib/server/ownership.server";

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  symbol: z.string().trim().min(2).max(20),
  riskProfile: z.enum(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"]),
  timeframe: z.string().trim().max(10).nullish(),
  brokerConnectionId: z.string().uuid().nullish(),
  strategyId: z.string().uuid().nullish(),
  configuration: z.record(z.string(), z.unknown()).default({}),
});

export const createBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireConnectionOwnership(supabase, data.brokerConnectionId, userId);

    const { data: row, error } = await supabase
      .from("bots")
      .insert({
        user_id: userId,
        name: data.name,
        symbol: data.symbol.toUpperCase(),
        risk_profile: data.riskProfile,
        timeframe: data.timeframe ?? null,
        broker_connection_id: data.brokerConnectionId ?? null,
        strategy_id: data.strategyId ?? null,
        status: "STOPPED",
        configuration: data.configuration as never,
      })
      .select("*")
      .single();
    if (error) throw toApiError(error);

    await recordAudit({ userId, action: "BOT_CREATED", entityType: "bot", entityId: row.id });
    return row;
  });

const updateSchema = z.object({
  botId: z.string().uuid(),
  name: z.string().trim().min(2).max(60).optional(),
  timeframe: z.string().trim().max(10).nullish(),
  riskProfile: z.enum(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"]).optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
});

export const updateBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOwnership(supabase, "bots", data.botId, userId);

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch["name"] = data.name;
    if (data.timeframe !== undefined) patch["timeframe"] = data.timeframe;
    if (data.riskProfile !== undefined) patch["risk_profile"] = data.riskProfile;
    if (data.configuration !== undefined) patch["configuration"] = data.configuration;
    if (Object.keys(patch).length === 0) throw invalid("Nothing to update.");

    const { error } = await supabase
      .from("bots")
      .update(patch as never)
      .eq("id", data.botId);
    if (error) throw toApiError(error);

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
    if (readError) throw toApiError(readError);

    const connected =
      (bot as unknown as { broker_connections: { status: string } | null }).broker_connections
        ?.status === "CONNECTED";
    const status = data.status === "RUNNING" && !connected ? "WAITING" : data.status;

    const { error } = await supabase.from("bots").update({ status }).eq("id", data.botId);
    if (error) throw toApiError(error);

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
    if (error) throw toApiError(error);
    await recordAudit({ userId, action: "BOT_DELETED", entityType: "bot", entityId: data.botId });
    return { ok: true as const };
  });
