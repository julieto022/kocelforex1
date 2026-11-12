import { describe, expect, it } from "vitest";

import { analyzeCustomRules, defaultCustomRules, type CustomRules } from "./custom-rules";

const indicators = {
  close: 100,
  sma20: 99,
  ema9: 99,
  ema20: 98,
  ema50: 97,
  rsi14: 60,
  momentum10: 1,
  atr14: 2,
  standardDeviation20: 1,
  highestHigh20: 105,
  lowestLow20: 95,
  averageRange14: 2,
  vwap: 99,
};

function analyze(
  customRules: unknown,
  values: Parameters<typeof analyzeCustomRules>[0]["indicators"] = indicators,
) {
  return analyzeCustomRules({
    configuration: { customRules },
    candles: Array.from({ length: 55 }),
    indicators: values,
  });
}

describe("analyzeCustomRules", () => {
  it("applies ATR-based exits when one direction matches", () => {
    const result = analyze(defaultCustomRules);

    expect(result.direction).toBe("BUY");
    expect(result.stopLoss).toBe(97);
    expect(result.takeProfit).toBe(106);
  });

  it("returns an unavailable signal for invalid rules and missing indicator values", () => {
    expect(analyze({ version: 2 }).state).toBe("STRATEGY_UNAVAILABLE");
    expect(analyze(defaultCustomRules, { ...indicators, rsi14: null }).state).toBe(
      "INSUFFICIENT_DATA",
    );
  });

  it("does not choose a direction when both rule sets match", () => {
    const ambiguous: CustomRules = {
      ...defaultCustomRules,
      buy: [{ left: "rsi14", operator: "gt", right: 50 }],
      sell: [{ left: "rsi14", operator: "gt", right: 50 }],
    };

    const result = analyze(ambiguous);
    expect(result.direction).toBe("NONE");
    expect(result.reason).toContain("ambiguous");
  });
});
