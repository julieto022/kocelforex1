import { conflict, forbidden, invalid, notFound } from "@/lib/api/errors";
import { recordAudit } from "@/lib/server/audit.server";
import { getStrategyDefinition } from "@/lib/trading/strategies/registry";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function requireOwnedStrategy(userId: string, strategyId: string) {
  const db = await admin();
  const { data: strategy, error } = await db
    .from("strategies")
    .select(
      "id, user_id, is_builtin, is_active, name, slug, description, short_description, category, configuration",
    )
    .eq("id", strategyId)
    .maybeSingle();
  if (error) throw error;
  if (!strategy) throw notFound("That strategy was not found.");
  if (!strategy.is_builtin && strategy.user_id !== userId) {
    throw forbidden("You do not own that strategy.");
  }
  return strategy;
}

async function getStrategyOverride(userId: string, strategyId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("strategy_user_overrides")
    .select("*")
    .eq("user_id", userId)
    .eq("strategy_id", strategyId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function requireOwnedConnection(userId: string, connectionId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("broker_connections")
    .select("id, status")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("The MT5 account connected to this MCP key is unavailable.");
  return data;
}

export async function listMcpBots(userId: string, connectionId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("bots")
    .select(
      "id, name, symbol, status, enabled, risk_profile, broker_connection_id, strategy_id, timeframe, configuration, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("broker_connection_id", connectionId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function createMcpBot(
  userId: string,
  connectionId: string,
  input: {
    name: string;
    symbol: string;
    strategyId: string;
    timeframe: string;
    riskProfile: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";
    configuration: Record<string, unknown>;
  },
) {
  await requireOwnedConnection(userId, connectionId);
  const strategy = await requireOwnedStrategy(userId, input.strategyId);
  if (!strategy.is_active) throw invalid("This strategy is not active.");

  const db = await admin();
  const { data, error } = await db
    .from("bots")
    .insert({
      user_id: userId,
      name: input.name,
      symbol: input.symbol,
      strategy_id: input.strategyId,
      broker_connection_id: connectionId,
      timeframe: input.timeframe,
      risk_profile: input.riskProfile,
      status: "STOPPED",
      enabled: true,
      configuration: input.configuration as never,
    })
    .select(
      "id, name, symbol, status, enabled, risk_profile, broker_connection_id, strategy_id, timeframe, configuration, created_at, updated_at",
    )
    .single();
  if (error) throw error;
  await recordAudit({ userId, action: "BOT_CREATED", entityType: "bot", entityId: data.id });
  return data;
}

export async function updateMcpBot(
  userId: string,
  connectionId: string,
  botId: string,
  patch: {
    name?: string | undefined;
    symbol?: string | undefined;
    strategyId?: string | undefined;
    timeframe?: string | undefined;
    riskProfile?: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE" | undefined;
    configuration?: Record<string, unknown> | undefined;
  },
) {
  const db = await admin();
  const { data: bot, error: lookupError } = await db
    .from("bots")
    .select("id")
    .eq("id", botId)
    .eq("user_id", userId)
    .eq("broker_connection_id", connectionId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!bot) throw notFound("That bot was not found for the MT5 account connected to this key.");
  if (patch.strategyId) {
    const strategy = await requireOwnedStrategy(userId, patch.strategyId);
    if (!strategy.is_active) throw invalid("This strategy is not active.");
  }

  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates["name"] = patch.name;
  if (patch.symbol !== undefined) updates["symbol"] = patch.symbol;
  if (patch.strategyId !== undefined) updates["strategy_id"] = patch.strategyId;
  if (patch.timeframe !== undefined) updates["timeframe"] = patch.timeframe;
  if (patch.riskProfile !== undefined) updates["risk_profile"] = patch.riskProfile;
  if (patch.configuration !== undefined) updates["configuration"] = patch.configuration;
  if (Object.keys(updates).length === 0) throw invalid("Provide at least one bot field to update.");

  const { data, error } = await db
    .from("bots")
    .update(updates as never)
    .eq("id", botId)
    .eq("user_id", userId)
    .select(
      "id, name, symbol, status, enabled, risk_profile, broker_connection_id, strategy_id, timeframe, configuration, created_at, updated_at",
    )
    .single();
  if (error) throw error;
  await recordAudit({ userId, action: "BOT_UPDATED", entityType: "bot", entityId: botId });
  return data;
}

export async function setMcpBotStatus(
  userId: string,
  connectionId: string,
  botId: string,
  requestedStatus: "DRAFT" | "STOPPED" | "RUNNING" | "PAUSED",
) {
  const db = await admin();
  const { data: bot, error: lookupError } = await db
    .from("bots")
    .select("id, name, broker_connection_id")
    .eq("id", botId)
    .eq("user_id", userId)
    .eq("broker_connection_id", connectionId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!bot) throw notFound("That bot was not found for the MT5 account connected to this key.");

  let status: "DRAFT" | "STOPPED" | "RUNNING" | "PAUSED" | "WAITING" = requestedStatus;
  if (status === "RUNNING") {
    const connection = await requireOwnedConnection(userId, connectionId);
    if (connection.status !== "CONNECTED") status = "WAITING";
  }
  const { error } = await db.from("bots").update({ status }).eq("id", botId).eq("user_id", userId);
  if (error) throw error;
  await recordAudit({
    userId,
    action: "BOT_STATE_CHANGED",
    entityType: "bot",
    entityId: botId,
    metadata: { status },
  });
  return { botId, status };
}

export async function deleteMcpBot(userId: string, connectionId: string, botId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("bots")
    .delete()
    .eq("id", botId)
    .eq("user_id", userId)
    .eq("broker_connection_id", connectionId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("That bot was not found for the MT5 account connected to this key.");
  await recordAudit({ userId, action: "BOT_DELETED", entityType: "bot", entityId: botId });
  return { deleted: true, botId };
}

export async function listMcpStrategies(userId: string) {
  const db = await admin();
  const [builtinsResult, ownedResult] = await Promise.all([
    db
      .from("strategies")
      .select(
        "id, user_id, is_builtin, is_active, name, slug, description, short_description, category, configuration, timeframes, markets, status, created_at, updated_at",
      )
      .eq("is_builtin", true)
      .eq("is_active", true),
    db
      .from("strategies")
      .select(
        "id, user_id, is_builtin, is_active, name, slug, description, short_description, category, configuration, timeframes, markets, status, created_at, updated_at",
      )
      .eq("user_id", userId)
      .eq("is_builtin", false),
  ]);
  if (builtinsResult.error) throw builtinsResult.error;
  if (ownedResult.error) throw ownedResult.error;
  const strategies = [...(builtinsResult.data ?? []), ...(ownedResult.data ?? [])];
  if (strategies.length === 0) return [];

  const { data: overrides, error: overrideError } = await db
    .from("strategy_user_overrides")
    .select("*")
    .eq("user_id", userId)
    .in(
      "strategy_id",
      strategies.map((strategy) => strategy.id),
    );
  if (overrideError) throw overrideError;
  const overrideById = new Map(
    (overrides ?? []).map((override) => [override.strategy_id, override]),
  );
  return strategies
    .map((strategy) => {
      const override = overrideById.get(strategy.id);
      return {
        ...strategy,
        name: override?.name_override ?? strategy.name,
        description: override?.description_override ?? strategy.description,
        short_description: override?.short_description_override ?? strategy.short_description,
        category: override?.category_override ?? strategy.category,
        configuration: override?.configuration_override ?? strategy.configuration,
        is_hidden: override?.is_hidden ?? false,
      };
    })
    .filter((strategy) => !strategy.is_hidden)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function createMcpStrategy(
  userId: string,
  input: {
    name: string;
    category: string;
    description: string;
    shortDescription: string;
    engineSlug: string;
    timeframes: string[];
    markets: string[];
    configuration: Record<string, unknown>;
  },
) {
  if (!getStrategyDefinition(input.engineSlug)) {
    throw invalid("Choose an engine strategy supported by the Kocel runtime.");
  }
  const db = await admin();
  const configuration = {
    ...input.configuration,
    runtimeStrategySlug: input.engineSlug,
  };
  const { data, error } = await db
    .from("strategies")
    .insert({
      user_id: userId,
      is_builtin: false,
      is_active: true,
      name: input.name,
      slug: `mcp-${userId.slice(0, 8)}-${crypto.randomUUID()}`,
      category: input.category,
      description: input.description,
      short_description: input.shortDescription,
      configuration: configuration as never,
      timeframes: input.timeframes as never,
      markets: input.markets as never,
      status: "available",
    })
    .select("id, name, slug, category, description, short_description, is_active, configuration")
    .single();
  if (error) throw error;
  await recordAudit({
    userId,
    action: "STRATEGY_CREATED",
    entityType: "strategy",
    entityId: data.id,
  });
  return data;
}

export async function updateMcpStrategy(
  userId: string,
  strategyId: string,
  patch: {
    name?: string | undefined;
    category?: string | undefined;
    description?: string | undefined;
    shortDescription?: string | undefined;
    engineSlug?: string | undefined;
    isActive?: boolean | undefined;
    configuration?: Record<string, unknown> | undefined;
  },
) {
  if (Object.values(patch).every((value) => value === undefined)) {
    throw invalid("Provide at least one strategy field to update.");
  }
  const strategy = await requireOwnedStrategy(userId, strategyId);
  if (!strategy.is_active && strategy.is_builtin)
    throw invalid("This system strategy is unavailable.");
  const db = await admin();
  const existingOverride = strategy.is_builtin
    ? await getStrategyOverride(userId, strategyId)
    : null;
  const currentConfiguration = asRecord(
    existingOverride?.configuration_override ?? strategy.configuration,
  );
  const nextConfiguration = {
    ...currentConfiguration,
    ...patch.configuration,
    ...(patch.engineSlug ? { runtimeStrategySlug: patch.engineSlug } : {}),
  };
  const runtimeSlug =
    typeof nextConfiguration["runtimeStrategySlug"] === "string"
      ? nextConfiguration["runtimeStrategySlug"]
      : strategy.slug;
  if (!getStrategyDefinition(runtimeSlug)) {
    throw invalid("The selected runtime strategy is not supported.");
  }
  if (patch.isActive === false && strategy.is_builtin) {
    return deleteMcpStrategy(userId, strategyId);
  }

  if (strategy.is_builtin) {
    const { error } = await db.from("strategy_user_overrides").upsert(
      {
        user_id: userId,
        strategy_id: strategyId,
        name_override: patch.name ?? existingOverride?.name_override ?? null,
        description_override: patch.description ?? existingOverride?.description_override ?? null,
        short_description_override:
          patch.shortDescription ?? existingOverride?.short_description_override ?? null,
        category_override: patch.category ?? existingOverride?.category_override ?? null,
        configuration_override:
          patch.configuration || patch.engineSlug
            ? (nextConfiguration as never)
            : (existingOverride?.configuration_override ?? null),
        is_hidden: false,
      },
      { onConflict: "user_id,strategy_id" },
    );
    if (error) throw error;
  } else {
    const updates: Record<string, unknown> = {};
    if (patch.name !== undefined) updates["name"] = patch.name;
    if (patch.category !== undefined) updates["category"] = patch.category;
    if (patch.description !== undefined) updates["description"] = patch.description;
    if (patch.shortDescription !== undefined) updates["short_description"] = patch.shortDescription;
    if (patch.configuration !== undefined || patch.engineSlug !== undefined) {
      updates["configuration"] = nextConfiguration;
    }
    if (patch.isActive !== undefined) updates["is_active"] = patch.isActive;
    if (Object.keys(updates).length === 0)
      throw invalid("Provide at least one strategy field to update.");
    const { error } = await db
      .from("strategies")
      .update(updates as never)
      .eq("id", strategyId)
      .eq("user_id", userId)
      .eq("is_builtin", false);
    if (error) throw error;
  }

  await recordAudit({
    userId,
    action: "STRATEGY_UPDATED",
    entityType: "strategy",
    entityId: strategyId,
  });
  return { strategyId, updated: true };
}

export async function deleteMcpStrategy(userId: string, strategyId: string) {
  const strategy = await requireOwnedStrategy(userId, strategyId);
  const db = await admin();
  if (strategy.is_builtin) {
    const existing = await getStrategyOverride(userId, strategyId);
    const { error } = await db.from("strategy_user_overrides").upsert(
      {
        user_id: userId,
        strategy_id: strategyId,
        name_override: existing?.name_override ?? null,
        description_override: existing?.description_override ?? null,
        short_description_override: existing?.short_description_override ?? null,
        category_override: existing?.category_override ?? null,
        configuration_override: existing?.configuration_override ?? null,
        is_hidden: true,
      },
      { onConflict: "user_id,strategy_id" },
    );
    if (error) throw error;
  } else {
    const { count, error: usageError } = await db
      .from("bots")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("strategy_id", strategyId);
    if (usageError) throw usageError;
    if ((count ?? 0) > 0) {
      throw conflict("Reassign or delete bots using this strategy before deleting it.");
    }
    const { count: analysisCount, error: analysisError } = await db
      .from("strategy_analysis")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("strategy_id", strategyId);
    if (analysisError) throw analysisError;
    if ((analysisCount ?? 0) > 0) {
      throw conflict(
        "This strategy has analysis history. Deactivate it instead to preserve that history.",
      );
    }
    const { error } = await db
      .from("strategies")
      .delete()
      .eq("id", strategyId)
      .eq("user_id", userId)
      .eq("is_builtin", false);
    if (error) throw error;
  }
  await recordAudit({
    userId,
    action: "STRATEGY_DELETED",
    entityType: "strategy",
    entityId: strategyId,
    metadata: { ownerHidden: strategy.is_builtin },
  });
  return { strategyId, deleted: true, scope: strategy.is_builtin ? "account" : "owner" };
}
