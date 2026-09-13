import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notFound } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { calculateIndicators } from "@/lib/trading/indicators";
import { normalizeMarketData, type MarketCandle } from "@/lib/trading/market/types";
import { getStrategyDefinition } from "@/lib/trading/strategies/registry";
import type { TradingSignal } from "@/lib/trading/signals/types";

const FRESHNESS_MS = 90_000;

function timeframeFreshnessMs(timeframe: string): number {
  const minutes: Record<string, number> = { M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440 };
  return (minutes[timeframe] ?? 1) * 60_000 * 2 + FRESHNESS_MS;
}

export const analyzeBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ botId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<TradingSignal> => {
    const { supabase, userId } = context;
    const startedAt = Date.now();
    const { data: bot, error: botError } = await supabase.from("bots").select("*").eq("id", data.botId).eq("user_id", userId).maybeSingle();
    if (botError || !bot) throw notFound("Bot not found.");

    const base = {
      id: crypto.randomUUID(), botId: bot.id, strategyId: bot.strategy_id, strategyName: "Unknown strategy", connectionId: bot.broker_connection_id ?? "",
      symbol: bot.symbol, timeframe: bot.timeframe ?? "", timestamp: new Date().toISOString(), direction: "NONE" as const,
      state: "DATA_UNAVAILABLE" as const, confidence: 0, entryPrice: null, stopLoss: null, takeProfit: null,
      reason: "Market data unavailable.", factors: [], marketState: "UNCLEAR" as const, dataTimestamp: null,
      dataStatus: "UNAVAILABLE" as const, candleCount: 0, latestPrice: null, indicators: {}, strategyVersion: "unknown",
    } satisfies Omit<TradingSignal, "strategyVersion"> & { strategyVersion: string };

    if (!bot.broker_connection_id) return { ...base, reason: "MT5_CONNECTION_NOT_CONFIGURED" };
    if (!bot.timeframe) return { ...base, reason: "TIMEFRAME_NOT_CONFIGURED" };

    const { data: connection } = await supabase.from("broker_connections").select("id, status, last_seen_at").eq("id", bot.broker_connection_id).eq("user_id", userId).maybeSingle();
    if (!connection) return { ...base, connectionId: bot.broker_connection_id, reason: "MT5_CONNECTION_NOT_FOUND" };
    const lastSeen = connection.last_seen_at ? Date.parse(connection.last_seen_at) : NaN;
    if (connection.status !== "CONNECTED") return { ...base, connectionId: connection.id, reason: `MT5_CONNECTION_${connection.status}` };
    if (!Number.isFinite(lastSeen) || Date.now() - lastSeen > FRESHNESS_MS) return { ...base, connectionId: connection.id, dataStatus: "STALE", reason: "BRIDGE_HEARTBEAT_STALE" };

    const db = supabase as unknown as { from: (table: string) => any };
    const { data: strategy } = await supabase.from("strategies").select("id, name, slug, is_active").eq("id", bot.strategy_id).maybeSingle();
    if (!strategy) return { ...base, connectionId: connection.id, reason: "STRATEGY_NOT_FOUND" };
    if (!strategy.is_active) return { ...base, connectionId: connection.id, strategyId: strategy.id, reason: "STRATEGY_INACTIVE" };
    const definition = getStrategyDefinition(strategy.slug);
    if (!definition) return { ...base, connectionId: connection.id, strategyId: strategy.id, reason: "STRATEGY_UNAVAILABLE" };

    const { data: rows, error: candleError } = await db.from("market_candles").select("timestamp, open, high, low, close, volume").eq("broker_connection_id", connection.id).eq("symbol", bot.symbol).eq("timeframe", bot.timeframe).order("timestamp", { ascending: false }).limit(500);
    if (candleError) return { ...base, connectionId: connection.id, strategyId: strategy.id, strategyVersion: definition.version, reason: "MARKET_DATA_QUERY_FAILED" };
    if (!rows?.length) {
      const { data: otherSymbols } = await db.from("market_candles").select("symbol").eq("broker_connection_id", connection.id).eq("timeframe", bot.timeframe).neq("symbol", bot.symbol).limit(1);
      return {
        ...base,
        connectionId: connection.id,
        strategyId: strategy.id,
        strategyVersion: definition.version,
        reason: otherSymbols?.length ? "SYMBOL_NOT_AVAILABLE" : "MARKET_DATA_NOT_SYNCED",
      };
    }
    const market = normalizeMarketData(bot.symbol, bot.timeframe, [...(rows as MarketCandle[])].reverse(), 50);
    if (!market.quality.ok) return { ...base, connectionId: connection.id, strategyId: strategy.id, strategyVersion: definition.version, state: market.quality.code === "INSUFFICIENT_DATA" ? "INSUFFICIENT_DATA" : "DATA_UNAVAILABLE", reason: market.quality.code, dataTimestamp: market.latestTimestamp };
    if (!market.latestTimestamp || Date.now() - Date.parse(market.latestTimestamp) > timeframeFreshnessMs(bot.timeframe)) {
      return { ...base, connectionId: connection.id, strategyId: strategy.id, strategyVersion: definition.version, dataStatus: "STALE", reason: "STALE_MARKET_DATA", dataTimestamp: market.latestTimestamp };
    }
    const indicators = calculateIndicators(market.candles);
    const result = definition.analyze({ botId: bot.id, strategyId: strategy.id, symbol: bot.symbol, timeframe: bot.timeframe, configuration: (bot.configuration ?? {}) as Record<string, unknown>, market, candles: market.candles, indicators });
    const signal: TradingSignal = { ...base, connectionId: connection.id, strategyId: strategy.id, strategyName: strategy.name, strategyVersion: definition.version, ...result, dataTimestamp: market.latestTimestamp, dataStatus: "FRESH", candleCount: market.candles.length, latestPrice: indicators.close, indicators: { ema20: indicators.ema20, ema50: indicators.ema50, rsi14: indicators.rsi14, macd: indicators.macd?.macd ?? null, atr14: indicators.atr14, momentum10: indicators.momentum10 } };
    const { error: historyError } = await db.from("strategy_analysis").insert({
      user_id: userId,
      bot_id: bot.id,
      strategy_id: strategy.id,
      broker_connection_id: connection.id,
      symbol: bot.symbol,
      timeframe: bot.timeframe,
      analyzed_at: signal.timestamp,
      data_timestamp: signal.dataTimestamp,
      data_status: signal.dataStatus,
      signal_state: signal.state,
      direction: signal.direction,
      confidence: signal.confidence,
      entry_price: signal.entryPrice,
      stop_loss: signal.stopLoss,
      take_profit: signal.takeProfit,
      market_state: signal.marketState,
      reason: signal.reason,
      factors: signal.factors,
      indicator_snapshot: {},
      strategy_version: signal.strategyVersion,
    });
    if (historyError) logger.warn("database", "[STRATEGY_ENGINE] analysis history was not stored", { botId: bot.id, code: historyError.code, message: historyError.message });
    logger.info("system", "[STRATEGY_ENGINE] analysis completed", { botId: bot.id, strategy: strategy.slug, symbol: bot.symbol, timeframe: bot.timeframe, dataTimestamp: market.latestTimestamp, marketState: signal.marketState, direction: signal.direction, confidence: signal.confidence, durationMs: Date.now() - startedAt });
    return signal;
  });