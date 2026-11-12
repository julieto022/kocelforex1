import { invalid, notFound } from "@/lib/api/errors";
import { recordAudit } from "@/lib/server/audit.server";
import {
  BACKTEST_ENGINE_VERSION,
  MAX_BACKTEST_CANDLES,
  simulateBacktest,
  type BacktestSettings,
} from "@/lib/trading/backtest/engine";
import { isTradingTimeframe, type MarketCandle } from "@/lib/trading/market/types";
import { getStrategyDefinition } from "@/lib/trading/strategies/registry";
import { isStrategySymbolAllowed } from "@/lib/trading/strategies/symbols";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function requireStrategy(userId: string, strategyId: string) {
  const db = await admin();
  const { data: strategy, error } = await db
    .from("strategies")
    .select("id, user_id, is_builtin, is_active, name, slug, configuration")
    .eq("id", strategyId)
    .maybeSingle();
  if (error) throw error;
  if (!strategy || !strategy.is_active) throw notFound("The selected strategy is unavailable.");
  if (!strategy.is_builtin && strategy.user_id !== userId) {
    throw notFound("The selected strategy is unavailable.");
  }

  let configuration = asRecord(strategy.configuration);
  if (strategy.is_builtin) {
    const { data: override, error: overrideError } = await db
      .from("strategy_user_overrides")
      .select("configuration_override, is_hidden")
      .eq("user_id", userId)
      .eq("strategy_id", strategyId)
      .maybeSingle();
    if (overrideError) throw overrideError;
    if (override?.is_hidden) throw notFound("The selected strategy is hidden for this account.");
    if (override?.configuration_override) {
      configuration = asRecord(override.configuration_override);
    }
  }

  const runtimeSlug =
    typeof configuration["runtimeStrategySlug"] === "string"
      ? configuration["runtimeStrategySlug"]
      : strategy.slug;
  const definition = getStrategyDefinition(runtimeSlug);
  if (!definition) {
    throw invalid("This strategy has no supported runtime and cannot be backtested.");
  }
  return { strategy, configuration, definition };
}

export async function getBacktestCatalog(userId: string, connectionId: string) {
  const db = await admin();
  const { data: connection, error: connectionError } = await db
    .from("broker_connections")
    .select("id")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (connectionError) throw connectionError;
  if (!connection) throw notFound("The selected MT5 account was not found.");

  const pairs = new Map<
    string,
    { symbol: string; timeframe: string; count: number; firstAt: string; lastAt: string }
  >();
  const { data: marketSymbols, error: symbolsError } = await db
    .from("market_symbols")
    .select("symbol")
    .eq("broker_connection_id", connectionId)
    .eq("user_id", userId)
    .eq("status", "enabled")
    .order("symbol", { ascending: true })
    .limit(5_000);
  if (symbolsError) throw symbolsError;
  const pageSize = 1_000;
  const sampleLimit = 5_000;
  for (let offset = 0; offset < sampleLimit; offset += pageSize) {
    const { data, error } = await db
      .from("market_candles")
      .select("symbol, timeframe, timestamp")
      .eq("broker_connection_id", connectionId)
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .range(offset, Math.min(offset + pageSize - 1, sampleLimit - 1));
    if (error) throw error;
    for (const row of data ?? []) {
      const key = `${row.symbol}\u0000${row.timeframe}`;
      const existing = pairs.get(key);
      if (existing) {
        existing.count += 1;
        if (row.timestamp < existing.firstAt) existing.firstAt = row.timestamp;
        if (row.timestamp > existing.lastAt) existing.lastAt = row.timestamp;
      } else {
        pairs.set(key, {
          symbol: row.symbol,
          timeframe: row.timeframe,
          count: 1,
          firstAt: row.timestamp,
          lastAt: row.timestamp,
        });
      }
    }
    if ((data?.length ?? 0) < pageSize) break;
  }

  const { data: runs, error: runsError } = await db
    .from("backtest_runs")
    .select(
      "id, strategy_name, symbol, timeframe, start_at, end_at, candle_count, metrics, created_at",
    )
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: false })
    .limit(25);
  if (runsError) throw runsError;
  return {
    data: [...pairs.values()].sort(
      (left, right) =>
        left.symbol.localeCompare(right.symbol) || left.timeframe.localeCompare(right.timeframe),
    ),
    symbols: (marketSymbols ?? []).map(({ symbol }) => symbol),
    sampled: pairs.size > 0,
    runs: runs ?? [],
  };
}

export async function runBacktestForUser(input: {
  userId: string;
  connectionId: string;
  strategyId: string;
  symbol: string;
  timeframe: string;
  startAt: string;
  endAt: string;
  settings: BacktestSettings;
}) {
  if (!isTradingTimeframe(input.timeframe))
    throw invalid("The selected timeframe is not supported.");
  const symbol = input.symbol.trim();
  if (!symbol || symbol.length > 64) throw invalid("The selected symbol is invalid.");
  const startMs = Date.parse(input.startAt);
  const endMs = Date.parse(input.endAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    throw invalid("Choose a valid backtest date range.");
  }
  if (startMs > Date.now()) throw invalid("The backtest start date cannot be in the future.");

  const db = await admin();
  const { data: connection, error: connectionError } = await db
    .from("broker_connections")
    .select("id")
    .eq("id", input.connectionId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (connectionError) throw connectionError;
  if (!connection) throw notFound("The selected MT5 account was not found.");

  const { strategy, configuration, definition } = await requireStrategy(
    input.userId,
    input.strategyId,
  );
  if (!isStrategySymbolAllowed(configuration, symbol)) {
    throw invalid("The selected symbol is not allowed by this strategy.");
  }
  const { count, error: countError } = await db
    .from("market_candles")
    .select("timestamp", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("broker_connection_id", input.connectionId)
    .eq("symbol", symbol)
    .eq("timeframe", input.timeframe)
    .gte("timestamp", input.startAt)
    .lte("timestamp", input.endAt);
  if (countError) throw countError;
  if (!count) throw invalid("No EA-synced candles exist in the selected date range.");
  if (count > MAX_BACKTEST_CANDLES) {
    throw invalid(
      `The selected range contains more than ${MAX_BACKTEST_CANDLES.toLocaleString()} candles. Narrow the date range.`,
    );
  }

  const rows: MarketCandle[] = [];
  for (let offset = 0; offset < count; offset += 1_000) {
    const { data, error } = await db
      .from("market_candles")
      .select("timestamp, open, high, low, close, volume")
      .eq("user_id", input.userId)
      .eq("broker_connection_id", input.connectionId)
      .eq("symbol", symbol)
      .eq("timeframe", input.timeframe)
      .gte("timestamp", input.startAt)
      .lte("timestamp", input.endAt)
      .order("timestamp", { ascending: true })
      .range(offset, Math.min(offset + 999, count - 1));
    if (error) throw error;
    rows.push(...((data ?? []) as MarketCandle[]));
  }

  const { data: warmupRows, error: warmupError } = await db
    .from("market_candles")
    .select("timestamp, open, high, low, close, volume")
    .eq("user_id", input.userId)
    .eq("broker_connection_id", input.connectionId)
    .eq("symbol", symbol)
    .eq("timeframe", input.timeframe)
    .lt("timestamp", input.startAt)
    .order("timestamp", { ascending: false })
    .limit(55);
  if (warmupError) throw warmupError;
  const candles = [...((warmupRows ?? []) as MarketCandle[]).reverse(), ...rows];
  if (candles.length > MAX_BACKTEST_CANDLES) {
    throw invalid(
      `The selected range and indicator warm-up contain more than ${MAX_BACKTEST_CANDLES.toLocaleString()} candles. Narrow the date range.`,
    );
  }
  if (candles.length < 55) {
    throw invalid(
      "At least 55 valid candles, including available EA history before the test start, are required.",
    );
  }

  const result = simulateBacktest({
    strategy: definition,
    strategyId: strategy.id,
    symbol,
    timeframe: input.timeframe,
    configuration,
    candles,
    settings: input.settings,
    startAt: input.startAt,
    endAt: input.endAt,
  });
  const { data: run, error: insertError } = await db
    .from("backtest_runs")
    .insert({
      user_id: input.userId,
      connection_id: input.connectionId,
      strategy_id: strategy.id,
      strategy_name: strategy.name,
      symbol,
      timeframe: input.timeframe,
      start_at: input.startAt,
      end_at: input.endAt,
      candle_count: rows.length,
      engine_version: BACKTEST_ENGINE_VERSION,
      settings: input.settings as never,
      metrics: result.metrics as never,
      equity_curve: result.equityCurve as never,
      trades: result.trades as never,
    })
    .select(
      "id, strategy_name, symbol, timeframe, start_at, end_at, candle_count, engine_version, settings, metrics, equity_curve, trades, created_at",
    )
    .single();
  if (insertError) throw insertError;
  await recordAudit({
    userId: input.userId,
    action: "BACKTEST_CREATED",
    entityType: "backtest_run",
    entityId: run.id,
  });
  return run;
}

export async function getBacktestRun(userId: string, connectionId: string, runId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("backtest_runs")
    .select(
      "id, strategy_name, symbol, timeframe, start_at, end_at, candle_count, engine_version, settings, metrics, equity_curve, trades, created_at",
    )
    .eq("id", runId)
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("That backtest run was not found.");
  return data;
}

export async function deleteBacktestRun(userId: string, connectionId: string, runId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("backtest_runs")
    .delete()
    .eq("id", runId)
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("That backtest run was not found.");
  await recordAudit({
    userId,
    action: "BACKTEST_DELETED",
    entityType: "backtest_run",
    entityId: runId,
  });
  return { deleted: true, runId };
}
