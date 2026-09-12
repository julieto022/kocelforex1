import { describe, expect, it } from "vitest";

import { validateStrategy } from "./strategies.functions";

describe("strategy validation", () => {
  it("accepts a valid user strategy", () => {
    const payload = {
      name: "EMA Pullback",
      description: "Trend continuation setup with moving averages",
      category: "scalping",
      subcategory: "ema_pullback",
      strategyType: "manual",
      status: "ACTIVE",
      version: "1.0",
      configuration: {
        entry: { type: "breakout" },
        exit: { type: "trail" },
        indicators: { emas: [9, 21] },
        timeframes: ["M15", "H1"],
        symbols: ["EURUSD"],
        risk: { max_risk_per_trade: 0.01 },
      },
    };

    expect(validateStrategy(payload)).toMatchObject({
      name: "EMA Pullback",
      category: "scalping",
      status: "ACTIVE",
    });
  });

  it("rejects invalid strategy data", () => {
    expect(() =>
      validateStrategy({
        name: "",
        description: "",
        category: "unknown_category",
        subcategory: "ema_pullback",
        strategyType: "manual",
        status: "ACTIVE",
        version: "1.0",
        configuration: {},
      }),
    ).toThrow(/Strategy name is required|Unsupported category|configuration/);
  });
});
