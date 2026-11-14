import { describe, expect, it } from "vitest";

import type { MarketCandle } from "../market/types";
import type { StrategyDefinition } from "../strategies/types";
import { simulateBacktest } from "./engine";

function testCandles(
  overrides: Record<number, Partial<MarketCandle>> = {},
  length = 60,
  stepMinutes = 5,
) {
  return Array.from({ length }, (_, index): MarketCandle => {
    const close = index > 54 ? 100 + (index - 54) * 0.02 : 100;
    return {
      timestamp: new Date(Date.UTC(2025, 0, 1, 0, index * stepMinutes)).toISOString(),
      open: index > 54 ? close - 0.02 : 100,
      high: close + 0.01,
      low: close - 0.02,
      close,
      ...overrides[index],
    };
  });
}

const firstSignalTimestamp = new Date(Date.UTC(2025, 0, 1, 0, 54 * 5)).toISOString();
const oneSignalStrategy: StrategyDefinition = {
  slug: "test",
  version: "1",
  analyze: (context) => {
    if (context.candles.at(-1)?.timestamp !== firstSignalTimestamp) {
      return {
        state: "WAIT",
        direction: "NONE",
        confidence: 0,
        reason: "No test signal.",
        factors: [],
        marketState: "UNCLEAR",
        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
      };
    }
    return {
      state: "BUY",
      direction: "BUY",
      confidence: 70,
      reason: "Test entry.",
      factors: [],
      marketState: "TRENDING_UP",
      entryPrice: 100,
      stopLoss: 99,
      takeProfit: 102,
    };
  },
};

function run(candles: MarketCandle[], strategy = oneSignalStrategy, timeframe = "M5") {
  return simulateBacktest({
    strategy,
    strategyId: "test-strategy",
    symbol: "EURUSD",
    timeframe,
    configuration: {},
    candles,
    settings: { initialBalance: 10_000, riskPercent: 1, spread: 0, slippage: 0 },
    startAt: candles[0]!.timestamp,
    endAt: candles.at(-1)!.timestamp,
  });
}

describe("strategy backtesting", () => {
  it("enters at the following candle and treats same-candle stop/target ambiguity conservatively", () => {
    const candles = testCandles({
      55: { open: 100, high: 103, low: 98, close: 100 },
    });

    const result = run(candles);

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      openedAt: candles[55]!.timestamp,
      closedAt: candles[55]!.timestamp,
      entryPrice: 100,
      exitPrice: 99,
      exitReason: "STOP_LOSS",
      rMultiple: -1,
      profit: -100,
      balanceAfter: 9_900,
    });
  });

  it("marks an open position at the last available close and reports its equity impact", () => {
    const result = run(testCandles());

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]?.exitReason).toBe("END_OF_TEST");
    expect(result.trades[0]?.closedAt).toBe(new Date(Date.UTC(2025, 0, 1, 0, 295)).toISOString());
    expect(result.metrics).toMatchObject({
      totalTrades: 1,
      winningTrades: 1,
      losingTrades: 0,
      finalBalance: 10_010,
      netProfit: 10,
    });
  });

  it("backtests a full year of M1 data", () => {
    const candles = testCandles({}, 365 * 24 * 60, 1);
    const signalTimestamp = candles.at(-2)!.timestamp;
    const endOfRangeStrategy: StrategyDefinition = {
      slug: "end-of-range-test",
      version: "1",
      analyze: (context) =>
        context.candles.at(-1)?.timestamp === signalTimestamp
          ? {
              state: "BUY",
              direction: "BUY",
              confidence: 70,
              reason: "Test entry near the end of the range.",
              factors: [],
              marketState: "TRENDING_UP",
              entryPrice: context.candles.at(-1)!.close,
              stopLoss: context.candles.at(-1)!.close - 1,
              takeProfit: context.candles.at(-1)!.close + 2,
            }
          : {
              state: "WAIT",
              direction: "NONE",
              confidence: 0,
              reason: "No test signal.",
              factors: [],
              marketState: "UNCLEAR",
              entryPrice: null,
              stopLoss: null,
              takeProfit: null,
            },
    };

    const result = run(candles, endOfRangeStrategy, "M1");

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      openedAt: candles.at(-1)?.timestamp,
      closedAt: candles.at(-1)?.timestamp,
      exitReason: "END_OF_TEST",
    });
  }, 120_000);
});
