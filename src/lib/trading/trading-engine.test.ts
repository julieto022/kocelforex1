import { describe, expect, it } from "vitest";

import { atr, ema, macd, rsi, sma, vwap } from "./indicators";
import { normalizeMarketData, validateMarketCandles, type MarketCandle } from "./market/types";
import { getStrategyDefinition } from "./strategies/registry";

function candles(closes: number[], withVolume = true): MarketCandle[] {
  return closes.map((close, index) => ({
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    open: close - 0.5,
    high: close + 0.5,
    low: close - 1,
    close,
    ...(withVolume ? { volume: 100 + index } : {}),
  }));
}

describe("market data normalization", () => {
  it("rejects duplicate and invalid OHLC candles", () => {
    const invalid = candles([100, 101]);
    invalid[1] = { ...invalid[1]!, timestamp: invalid[0]!.timestamp };
    expect(validateMarketCandles(invalid)).toMatchObject({ ok: false, code: "DUPLICATE_TIMESTAMP" });
    expect(validateMarketCandles([{ ...candles([100])[0]!, high: 99 }])).toMatchObject({ ok: false, code: "INVALID_OHLC" });
  });

  it("rejects future-dated candles", () => {
    const future = { ...candles([100])[0]!, timestamp: new Date(Date.now() + 120_000).toISOString() };
    expect(validateMarketCandles([future])).toMatchObject({ ok: false, code: "INVALID_TIMESTAMP" });
  });

  it("rejects unsupported timeframes without manufacturing data", () => {
    const normalized = normalizeMarketData("EURUSDm", "TICK", candles([100, 101]));
    expect(normalized.quality.ok).toBe(false);
    expect(normalized.candles).toHaveLength(2);
  });
});

describe("indicators", () => {
  it("calculates deterministic trend and momentum indicators", () => {
    const values = [1, 2, 3, 4, 5];
    expect(sma(values, 3)).toBe(4);
    expect(ema(values, 3)).toBeCloseTo(4);
    expect(rsi(values, 3)).toBe(100);
    expect(atr(candles(values), 3)).toBeCloseTo(1.5);
  });

  it("returns null for unavailable history or volume", () => {
    expect(macd([1, 2, 3], 2, 3, 2)).toBeNull();
    expect(vwap(candles([1, 2], false))).toBeNull();
  });
});

describe("strategy registry", () => {
  it("resolves system slugs and refuses unsupported external data", () => {
    expect(getStrategyDefinition("kocel-ai-scalper")?.version).toBe("1.0");
    expect(getStrategyDefinition("nfp-news-trading")?.analyze({} as never).state).toBe("DATA_UNAVAILABLE");
    expect(getStrategyDefinition("carry")?.analyze({} as never).state).toBe("STRATEGY_UNAVAILABLE");
  });

  it("keeps the core strategy evaluators distinct", () => {
    const slugs = ["momentum", "ema-pullback", "break-retest", "liquidity-sweep", "day-trading", "trend-following"];
    const evaluators = slugs.map((slug) => getStrategyDefinition(slug)?.analyze);
    expect(new Set(evaluators).size).toBe(slugs.length);
  });

  it("does not force a conflicting scalper setup into a trade", () => {
    const definition = getStrategyDefinition("kocel-ai-scalper");
    const market = normalizeMarketData("EURUSD", "M5", candles(Array.from({ length: 60 }, (_, index) => 100 + (index % 2 ? 0.1 : 0))));
    const result = definition!.analyze({ botId: "bot", strategyId: "strategy", symbol: "EURUSD", timeframe: "M5", configuration: {}, market, candles: market.candles, indicators: { close: 100, sma20: 100, ema9: 100, ema20: 100, ema50: 100, rsi14: 50, macd: null, momentum10: 0, atr14: 1, standardDeviation20: 0, highestHigh20: 101, lowestLow20: 99, averageRange14: 2, vwap: 100 } });
    expect(result.direction).toBe("NONE");
  });
});