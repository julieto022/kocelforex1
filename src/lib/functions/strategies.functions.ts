import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { forbidden, invalid, notFound, toApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/server/audit.server";
import { requireOwnership } from "@/lib/server/ownership.server";

export const STRATEGY_CATEGORIES = [
  "scalping",
  "day_trading",
  "swing_trading",
  "position_trading",
  "trend_following",
  "range_trading",
  "breakout",
  "price_action",
  "nfp_news",
  "carry",
  "grid",
  "algorithmic_hft",
] as const;

export const STRATEGY_STATUSES = ["ACTIVE", "INACTIVE", "DRAFT", "ARCHIVED"] as const;
export const STRATEGY_TYPES = ["manual", "algorithmic", "hybrid"] as const;

const configurationSchema = z
  .object({
    entry: z.record(z.string(), z.unknown()).default({}),
    exit: z.record(z.string(), z.unknown()).default({}),
    indicators: z.record(z.string(), z.unknown()).default({}),
    filters: z.record(z.string(), z.unknown()).default({}),
    risk: z.record(z.string(), z.unknown()).default({}),
    sessions: z.record(z.string(), z.unknown()).default({}),
    timeframes: z.array(z.string()).default([]),
    symbols: z.array(z.string()).default([]),
  })
  .passthrough();

export const strategySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).default(""),
  category: z.enum(STRATEGY_CATEGORIES),
  subcategory: z.string().trim().min(1).max(80).optional(),
  strategyType: z.enum(STRATEGY_TYPES).default("manual"),
  status: z.enum(STRATEGY_STATUSES).default("DRAFT"),
  version: z.string().trim().regex(/^\d+\.\d+$/).default("1.0"),
  configuration: configurationSchema.default({}),
});

export type StrategyCategory = (typeof STRATEGY_CATEGORIES)[number];
export type StrategyStatus = (typeof STRATEGY_STATUSES)[number];
export type StrategyType = (typeof STRATEGY_TYPES)[number];
export type StrategyFormInput = z.infer<typeof strategySchema>;

export function validateStrategy(value: unknown): StrategyFormInput {
  const parsed = strategySchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.message ?? "Invalid strategy configuration.";
    if (issue?.path.includes("name") && message.includes("String must contain at least 2 character")) {
      throw invalid("Strategy name is required.");
    }
    if (issue?.path.includes("category")) {
      throw invalid("Unsupported category.");
    }
    if (issue?.path.includes("configuration")) {
      throw invalid("Invalid strategy configuration.");
    }
    if (issue?.path.includes("timeframes")) {
      throw invalid("Unsupported timeframe.");
    }
    if (issue?.path.includes("symbols")) {
      throw invalid("Unsupported symbol configuration.");
    }
    throw invalid(message);
  }

  return parsed.data;
}

export function slugifyStrategyName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "strategy";
}

async function getUniqueSlug(
  supabase: any,
  userId: string,
  baseName: string,
  currentId?: string,
): Promise<string> {
  const base = slugifyStrategyName(baseName);
  let next = base;
  let suffix = 1;

  while (true) {
    const { data, error } = await (supabase as any)
      .from("strategies")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", next)
      .maybeSingle();
    if (error) throw toApiError(error);
    if (!data || (currentId && data.id === currentId)) return next;
    next = `${base}-${suffix}`;
    suffix += 1;
  }
}

const builtInStrategies: Array<{
  name: string;
  description: string;
  category: StrategyCategory;
  subcategory: string;
  strategyType: StrategyType;
  status: StrategyStatus;
  configuration: Record<string, unknown>;
}> = [
  {
    name: "Scalping",
    description: "Fast intraday momentum framework focused on short-term execution and tight risk control.",
    category: "scalping",
    subcategory: "general",
    strategyType: "manual",
    status: "ACTIVE",
    configuration: {
      entry: { type: "breakout" },
      exit: { type: "structure" },
      indicators: { trend_filter: "EMA 20" },
      filters: { volatility: "medium" },
      sessions: { preferred: ["London", "New York"] },
      timeframes: ["M5", "M15"],
      symbols: ["EURUSD", "GBPUSD", "USDJPY"],
      risk: { max_risk_per_trade: 0.01 },
    },
  },
  {
    name: "Micro-Momentum",
    description: "Short-range momentum entries designed for fast directional continuation in liquid sessions.",
    category: "scalping",
    subcategory: "micro_momentum",
    strategyType: "algorithmic",
    status: "ACTIVE",
    configuration: {
      entry: { type: "momentum" },
      exit: { type: "quick_exit" },
      indicators: { rsi: 14, ema: [9, 21] },
      timeframes: ["M1", "M5"],
      symbols: ["EURUSD"],
      risk: { max_risk_per_trade: 0.005 },
    },
  },
  {
    name: "Momentum",
    description: "Directional momentum play on strong price acceleration with trend alignment.",
    category: "scalping",
    subcategory: "momentum",
    strategyType: "algorithmic",
    status: "ACTIVE",
    configuration: { entry: { type: "trend_pullback" }, indicators: { adx: 14 }, timeframes: ["M5", "M15"], symbols: ["EURUSD", "GBPUSD"], risk: { max_risk_per_trade: 0.01 } },
  },
  {
    name: "EMA Pullback",
    description: "Trend continuation entries with EMA pullback confirmation and disciplined risk control.",
    category: "scalping",
    subcategory: "ema_pullback",
    strategyType: "manual",
    status: "ACTIVE",
    configuration: { entry: { type: "ema_pullback" }, exit: { type: "structure" }, indicators: { emas: [9, 21, 50] }, timeframes: ["M15", "H1"], symbols: ["EURUSD", "GBPUSD"], risk: { max_risk_per_trade: 0.01 } },
  },
  {
    name: "Price Action",
    description: "Structure-driven entries based on support, resistance, and candle behavior.",
    category: "scalping",
    subcategory: "price_action",
    strategyType: "manual",
    status: "ACTIVE",
    configuration: { entry: { type: "structure_break" }, indicators: { patterns: ["pin_bar", "engulfing"] }, timeframes: ["M5", "M15"], symbols: ["EURUSD", "XAUUSD"], risk: { max_risk_per_trade: 0.01 } },
  },
  {
    name: "Break & Retest",
    description: "Retest entries after liquidity sweeps or breakout continuation events.",
    category: "scalping",
    subcategory: "break_retest",
    strategyType: "algorithmic",
    status: "ACTIVE",
    configuration: { entry: { type: "break_retest" }, filters: { liquidity: true }, timeframes: ["M5", "M15"], symbols: ["EURUSD", "USDJPY"], risk: { max_risk_per_trade: 0.008 } },
  },
  {
    name: "Liquidity Sweep",
    description: "Session-aware reversal entries triggered after liquidity grabs and imbalance fill.",
    category: "scalping",
    subcategory: "liquidity_sweep",
    strategyType: "hybrid",
    status: "ACTIVE",
    configuration: { entry: { type: "liquidity_sweep" }, indicators: { volume_profile: true }, timeframes: ["M5", "M15"], symbols: ["EURUSD", "GBPUSD"], risk: { max_risk_per_trade: 0.012 } },
  },
  {
    name: "VWAP",
    description: "Volume-weighted average price bias for intraday execution and mean reversion.",
    category: "scalping",
    subcategory: "vwap",
    strategyType: "algorithmic",
    status: "ACTIVE",
    configuration: { entry: { type: "vwap_reversion" }, indicators: { vwap: true }, timeframes: ["M5", "M15"], symbols: ["EURUSD"], risk: { max_risk_per_trade: 0.01 } },
  },
  {
    name: "ATR Volatility",
    description: "Range expansion system that takes trades when volatility confirms execution quality.",
    category: "scalping",
    subcategory: "atr_volatility",
    strategyType: "algorithmic",
    status: "ACTIVE",
    configuration: { entry: { type: "volatility_break" }, indicators: { atr: 14 }, timeframes: ["M5", "M15"], symbols: ["EURUSD", "GBPJPY"], risk: { max_risk_per_trade: 0.01 } },
  },
  {
    name: "Session",
    description: "Intraday session rotation model that focuses on the highest-probability market windows.",
    category: "scalping",
    subcategory: "session",
    strategyType: "manual",
    status: "ACTIVE",
    configuration: { sessions: { preferred: ["London", "New York"] }, timeframes: ["M5", "M15"], symbols: ["EURUSD", "GBPUSD"], risk: { max_risk_per_trade: 0.008 } },
  },
  {
    name: "Range",
    description: "Range trading methodology tuned for defined support and resistance behavior.",
    category: "scalping",
    subcategory: "range",
    strategyType: "manual",
    status: "ACTIVE",
    configuration: { entry: { type: "range_reversal" }, filters: { range_boundaries: true }, timeframes: ["M15", "H1"], symbols: ["USDJPY", "EURUSD"], risk: { max_risk_per_trade: 0.01 } },
  },
  {
    name: "Day Trading",
    description: "Intraday swing and breakout framework for structured directional trades during high-beta sessions.",
    category: "day_trading",
    subcategory: "general",
    strategyType: "hybrid",
    status: "ACTIVE",
    configuration: { entry: { type: "trend_follow" }, timeframes: ["M15", "H1"], symbols: ["EURUSD", "GBPUSD", "XAUUSD"], risk: { max_risk_per_trade: 0.02 } },
  },
  {
    name: "Swing Trading",
    description: "Multi-day trend continuation and pullback system built around swing structure and weekly context.",
    category: "swing_trading",
    subcategory: "general",
    strategyType: "hybrid",
    status: "ACTIVE",
    configuration: { entry: { type: "swing_pullback" }, timeframes: ["H4", "D1"], symbols: ["EURUSD", "AUDUSD"], risk: { max_risk_per_trade: 0.03 } },
  },
  {
    name: "Position Trading",
    description: "Longer-term directional framework emphasizing macro alignment and larger trend moves.",
    category: "position_trading",
    subcategory: "general",
    strategyType: "manual",
    status: "ACTIVE",
    configuration: { entry: { type: "macro_breakout" }, timeframes: ["H4", "D1", "W1"], symbols: ["EURUSD", "GBPUSD"], risk: { max_risk_per_trade: 0.05 } },
  },
  {
    name: "Trend Following",
    description: "Higher-conviction trades aligned with established directional bias and momentum persistence.",
    category: "trend_following",
    subcategory: "general",
    strategyType: "algorithmic",
    status: "ACTIVE",
    configuration: { entry: { type: "trend_follow" }, indicators: { ema: [20, 50, 200] }, timeframes: ["H1", "H4"], symbols: ["EURUSD", "USDJPY"], risk: { max_risk_per_trade: 0.02 } },
  },
  {
    name: "Range Trading",
    description: "Mean-reversion framework for areas of repeated support and resistance interaction.",
    category: "range_trading",
    subcategory: "general",
    strategyType: "manual",
    status: "ACTIVE",
    configuration: { entry: { type: "range_mean_reversion" }, filters: { range_confirmed: true }, timeframes: ["H1", "H4"], symbols: ["USDJPY", "AUDUSD"], risk: { max_risk_per_trade: 0.02 } },
  },
  {
    name: "Breakout",
    description: "Volatility breakout framework built around clean expansion beyond prior structure.",
    category: "breakout",
    subcategory: "general",
    strategyType: "hybrid",
    status: "ACTIVE",
    configuration: { entry: { type: "breakout" }, filters: { volume_confirmation: true }, timeframes: ["H1", "H4"], symbols: ["EURUSD", "GBPJPY"], risk: { max_risk_per_trade: 0.025 } },
  },
  {
    name: "NFP News Trading",
    description: "News-driven execution model with defined reaction windows and volatility filters.",
    category: "nfp_news",
    subcategory: "general",
    strategyType: "algorithmic",
    status: "DRAFT",
    configuration: { entry: { type: "news_reaction" }, filters: { event_window: "NFP" }, timeframes: ["M1", "M5"], symbols: ["USDJPY", "EURUSD"], risk: { max_risk_per_trade: 0.015 } },
  },
  {
    name: "Carry",
    description: "Roll-yield strategy focused on interest-rate differentials and stable macro trends.",
    category: "carry",
    subcategory: "general",
    strategyType: "manual",
    status: "ACTIVE",
    configuration: { entry: { type: "carry_bias" }, filters: { macro_alignment: true }, timeframes: ["D1", "W1"], symbols: ["AUDUSD", "NZDUSD"], risk: { max_risk_per_trade: 0.03 } },
  },
  {
    name: "Grid",
    description: "Grid-style execution tuned for range conditions and controlled layering.",
    category: "grid",
    subcategory: "general",
    strategyType: "algorithmic",
    status: "INACTIVE",
    configuration: { entry: { type: "grid" }, filters: { trend_filter: "neutral" }, timeframes: ["H1", "H4"], symbols: ["EURUSD"], risk: { max_risk_per_trade: 0.02 } },
  },
  {
    name: "Algorithmic / HFT",
    description: "High-frequency directional framework tuned for rapid microstructure reactions and disciplined risk limits.",
    category: "algorithmic_hft",
    subcategory: "general",
    strategyType: "algorithmic",
    status: "ACTIVE",
    configuration: { entry: { type: "microstructure" }, filters: { latency: "low" }, timeframes: ["M1", "M5"], symbols: ["EURUSD", "XAUUSD"], risk: { max_risk_per_trade: 0.005 } },
  },
];

async function ensureBuiltInStrategies(supabase: any) {
  for (const strategy of builtInStrategies) {
    const slug = slugifyStrategyName(strategy.name);
    const payload = {
      user_id: null,
      name: strategy.name,
      slug,
      description: strategy.description,
      category: strategy.category,
      subcategory: strategy.subcategory,
      strategy_type: strategy.strategyType,
      status: strategy.status,
      is_builtin: true,
      is_active: strategy.status === "ACTIVE",
      version: "1.0",
      configuration: strategy.configuration,
      configuration_schema: {
        entry: { type: "string" },
        exit: { type: "string" },
        indicators: { type: "object" },
        filters: { type: "object" },
        risk: { type: "object" },
        sessions: { type: "object" },
        timeframes: { type: "array" },
        symbols: { type: "array" },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("strategies").upsert(payload, { onConflict: "slug" }).select();
    if (error) {
      if (!error.message.includes("duplicate") && !error.message.includes("already exists")) {
        throw toApiError(error);
      }
    }
  }
}

export const getStrategies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureBuiltInStrategies(supabase);
    const { data, error } = await supabase
      .from("strategies")
      .select("*")
      .or(`user_id.eq.${userId},is_builtin.eq.true`)
      .order("updated_at", { ascending: false });
    if (error) throw toApiError(error);
    return (data ?? []) as any[];
  });

export const getStrategy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ strategyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("strategies")
      .select("*")
      .eq("id", data.strategyId)
      .maybeSingle();
    if (error) throw toApiError(error);
    if (!row) throw notFound("Strategy not found.");
    const rowAny = row as any;
    if (rowAny.user_id !== userId && !rowAny.is_builtin) throw forbidden("You do not have access to this strategy.");
    return rowAny;
  });

export const createStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => strategySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const validated = validateStrategy(data);
    const slug = await getUniqueSlug(supabase as any, userId, validated.name);

    const insert: Record<string, unknown> = {
      user_id: userId,
      name: validated.name,
      slug,
      description: validated.description,
      category: validated.category,
      subcategory: validated.subcategory ?? null,
      strategy_type: validated.strategyType,
      status: validated.status,
      is_builtin: false,
      is_active: validated.status === "ACTIVE",
      version: validated.version,
      configuration: validated.configuration,
      configuration_schema: {
        entry: { type: "object" },
        exit: { type: "object" },
        indicators: { type: "object" },
        filters: { type: "object" },
        risk: { type: "object" },
        sessions: { type: "object" },
        timeframes: { type: "array" },
        symbols: { type: "array" },
      },
    };

    const { data: row, error } = await supabase.from("strategies").insert(insert as never).select("*").single();
    if (error) throw toApiError(error);
    await (recordAudit as any)({ userId, action: "STRATEGY_CREATED", entityType: "strategy", entityId: row.id });
    return row;
  });

export const updateStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        strategyId: z.string().uuid(),
        name: z.string().trim().min(2).max(80).optional(),
        description: z.string().trim().max(1000).optional(),
        category: z.enum(STRATEGY_CATEGORIES).optional(),
        subcategory: z.string().trim().max(80).nullish(),
        strategyType: z.enum(STRATEGY_TYPES).optional(),
        status: z.enum(STRATEGY_STATUSES).optional(),
        version: z.string().trim().regex(/^\d+\.\d+$/).optional(),
        configuration: configurationSchema.optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOwnership(supabase, "strategies", data.strategyId, userId);

    const { data: existing } = await supabase
      .from("strategies")
      .select("id, is_builtin, name, status")
      .eq("id", data.strategyId)
      .maybeSingle();
    if ((existing as any)?.is_builtin) throw forbidden("Built-in strategies are protected.");

    const patch: Record<string, unknown> = {};
    if (data.name) (patch as any)["name"] = data.name;
    if (data.description !== undefined) (patch as any)["description"] = data.description;
    if (data.category) (patch as any)["category"] = data.category;
    if (data.subcategory !== undefined) (patch as any)["subcategory"] = data.subcategory ?? null;
    if (data.strategyType) (patch as any)["strategy_type"] = data.strategyType;
    if (data.status) (patch as any)["status"] = data.status;
    if (data.version) (patch as any)["version"] = data.version;
    if (data.configuration) (patch as any)["configuration"] = data.configuration;
    (patch as any)["is_active"] = (data.status ?? (existing as any)?.status ?? "ACTIVE") === "ACTIVE";
    if (data.name) {
      (patch as any)["slug"] = await getUniqueSlug(supabase as any, userId, data.name, data.strategyId);
    }
    if (Object.keys(patch).length === 0) throw invalid("Nothing to update.");

    const { error } = await supabase.from("strategies").update(patch as never).eq("id", data.strategyId);
    if (error) throw toApiError(error);
    await (recordAudit as any)({ userId, action: "STRATEGY_UPDATED", entityType: "strategy", entityId: data.strategyId });
    return { ok: true as const };
  });

export const deleteStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ strategyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("strategies")
      .select("id, user_id, is_builtin")
      .eq("id", data.strategyId)
      .maybeSingle();
    if (error) throw toApiError(error);
    if (!row) throw notFound("Strategy not found.");
    if ((row as any).is_builtin) throw forbidden("Built-in strategies cannot be deleted.");
    if ((row as any).user_id !== userId) throw forbidden("You do not have permission to delete this strategy.");

    const { error: deleteError } = await supabase.from("strategies").delete().eq("id", data.strategyId);
    if (deleteError) throw toApiError(deleteError);
    await (recordAudit as any)({ userId, action: "STRATEGY_DELETED", entityType: "strategy", entityId: data.strategyId });
    return { ok: true as const };
  });

export const duplicateStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ strategyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: original, error } = await supabase
      .from("strategies")
      .select("*")
      .eq("id", data.strategyId)
      .maybeSingle();
    if (error) throw toApiError(error);
    if (!original) throw notFound("Strategy not found.");
    const originalRow = original as any;
    if (originalRow.user_id !== userId && !originalRow.is_builtin) {
      throw forbidden("You do not have permission to duplicate this strategy.");
    }

    const copyName = `${originalRow.name} Copy`;
    const slug = await getUniqueSlug(supabase as any, userId, copyName);
    const insert = {
      user_id: userId,
      name: copyName,
      slug,
      description: originalRow.description ?? "",
      category: originalRow.category ?? "scalping",
      subcategory: originalRow.subcategory ?? null,
      strategy_type: originalRow.strategy_type ?? "manual",
      status: "DRAFT",
      is_builtin: false,
      is_active: false,
      version: originalRow.version ?? "1.0",
      configuration: originalRow.configuration ?? {},
      configuration_schema: originalRow.configuration_schema ?? {
        entry: { type: "object" },
        exit: { type: "object" },
        indicators: { type: "object" },
        filters: { type: "object" },
        risk: { type: "object" },
        sessions: { type: "object" },
        timeframes: { type: "array" },
        symbols: { type: "array" },
      },
    };

    const { data: row, error: insertError } = await supabase.from("strategies").insert(insert as never).select("*").single();
    if (insertError) throw toApiError(insertError);
    await (recordAudit as any)({ userId, action: "STRATEGY_DUPLICATED", entityType: "strategy", entityId: row.id, metadata: { sourceId: data.strategyId } });
    return row;
  });

export const setStrategyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ strategyId: z.string().uuid(), status: z.enum(STRATEGY_STATUSES) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("strategies")
      .select("id, user_id, is_builtin")
      .eq("id", data.strategyId)
      .maybeSingle();
    if (error) throw toApiError(error);
    if (!row) throw notFound("Strategy not found.");
    if ((row as any).is_builtin) throw forbidden("Built-in strategies are protected.");
    if ((row as any).user_id !== userId) throw forbidden("You do not have permission to modify this strategy.");

    const { error: updateError } = await supabase
      .from("strategies")
      .update({ status: data.status, is_active: data.status === "ACTIVE" } as never)
      .eq("id", data.strategyId);
    if (updateError) throw toApiError(updateError);
    await (recordAudit as any)({ userId, action: "STRATEGY_STATUS_UPDATED", entityType: "strategy", entityId: data.strategyId, metadata: { status: data.status } });
    return { ok: true as const, status: data.status };
  });

export const exportStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ strategyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("strategies")
      .select("*")
      .eq("id", data.strategyId)
      .maybeSingle();
    if (error) throw toApiError(error);
    if (!row) throw notFound("Strategy not found.");
    const rowAny = row as any;
    if (rowAny.user_id !== userId && !rowAny.is_builtin) throw forbidden("You do not have permission to export this strategy.");

    return {
      format: "kocel-strategy",
      version: 1,
      strategy: {
        name: rowAny.name,
        description: rowAny.description ?? "",
        category: rowAny.category,
        subcategory: rowAny.subcategory,
        strategyType: rowAny.strategy_type ?? "manual",
        status: rowAny.status,
        version: rowAny.version ?? "1.0",
        configuration: rowAny.configuration ?? {},
      },
    };
  });

export const importStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        payload: z.union([z.string(), z.record(z.string(), z.unknown())]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let parsed: unknown = data.payload;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        throw invalid("Malformed JSON import.");
      }
    }
    const imported = z
      .object({
        format: z.literal("kocel-strategy"),
        version: z.number().int().min(1),
        strategy: z.any(),
      })
      .parse(parsed);

    const validated = validateStrategy(imported.strategy);
    const slug = await getUniqueSlug(supabase as any, userId, validated.name);

    const { data: row, error } = await supabase
      .from("strategies")
      .insert({
        user_id: userId,
        name: validated.name,
        slug,
        description: validated.description,
        category: validated.category,
        subcategory: validated.subcategory ?? null,
        strategy_type: validated.strategyType,
        status: validated.status,
        is_builtin: false,
        is_active: validated.status === "ACTIVE",
        version: validated.version,
        configuration: validated.configuration,
        configuration_schema: {
          entry: { type: "object" },
          exit: { type: "object" },
          indicators: { type: "object" },
          filters: { type: "object" },
          risk: { type: "object" },
          sessions: { type: "object" },
          timeframes: { type: "array" },
          symbols: { type: "array" },
        },
      } as never)
      .select("*")
      .single();
    if (error) throw toApiError(error);
    await (recordAudit as any)({ userId, action: "STRATEGY_IMPORTED", entityType: "strategy", entityId: row.id });
    return row;
  });
