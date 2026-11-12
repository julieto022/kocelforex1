import { z } from "zod";

import type { StrategyAnalysis } from "./types";

export const customIndicators = [
  "close",
  "sma20",
  "ema9",
  "ema20",
  "ema50",
  "rsi14",
  "momentum10",
  "atr14",
  "standardDeviation20",
  "highestHigh20",
  "lowestLow20",
  "averageRange14",
  "vwap",
] as const;

const customIndicatorSchema = z.enum(customIndicators);
const customConditionSchema = z
  .object({
    left: customIndicatorSchema,
    operator: z.enum(["gt", "gte", "lt", "lte"]),
    right: z.union([
      customIndicatorSchema,
      z.number().finite().min(-1_000_000_000).max(1_000_000_000),
    ]),
  })
  .strict();

export const customRulesSchema = z
  .object({
    version: z.literal(1),
    buy: z.array(customConditionSchema).min(1).max(8),
    sell: z.array(customConditionSchema).min(1).max(8),
    stopLossAtr: z.number().finite().min(0.1).max(10),
    takeProfitAtr: z.number().finite().min(0.1).max(20),
  })
  .strict();

export type CustomRules = z.infer<typeof customRulesSchema>;

type IndicatorValues = Record<(typeof customIndicators)[number], number | null>;

function indicatorValues(context: {
  indicators: {
    close: number | null;
    sma20: number | null;
    ema9: number | null;
    ema20: number | null;
    ema50: number | null;
    rsi14: number | null;
    momentum10: number | null;
    atr14: number | null;
    standardDeviation20: number | null;
    highestHigh20: number | null;
    lowestLow20: number | null;
    averageRange14: number | null;
    vwap: number | null;
  };
}): IndicatorValues {
  return context.indicators;
}

function matches(rules: CustomRules["buy"], values: IndicatorValues): boolean | null {
  const resolved = rules.map((rule) => {
    const left = values[rule.left];
    const right = typeof rule.right === "number" ? rule.right : values[rule.right];
    if (left === null || right === null) return null;
    switch (rule.operator) {
      case "gt":
        return left > right;
      case "gte":
        return left >= right;
      case "lt":
        return left < right;
      case "lte":
        return left <= right;
    }
  });
  if (resolved.some((value) => value === null)) return null;
  return resolved.every(Boolean);
}

function conditionLabel(rule: CustomRules["buy"][number]) {
  const operator = { gt: ">", gte: ">=", lt: "<", lte: "<=" }[rule.operator];
  return `${rule.left} ${operator} ${typeof rule.right === "number" ? rule.right : rule.right}`;
}

function noSignal(reason: string, state: StrategyAnalysis["state"] = "WAIT"): StrategyAnalysis {
  return {
    state,
    direction: "NONE",
    confidence: 0,
    reason,
    factors: [],
    marketState: "UNCLEAR",
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
  };
}

export function analyzeCustomRules(context: {
  configuration: Record<string, unknown>;
  candles: Array<unknown>;
  indicators: IndicatorValues;
}): StrategyAnalysis {
  const parsed = customRulesSchema.safeParse(context.configuration["customRules"]);
  if (!parsed.success) {
    return noSignal(
      "CUSTOM_RULES_INVALID: update the strategy's validated rule configuration.",
      "STRATEGY_UNAVAILABLE",
    );
  }
  if (context.candles.length < 55) {
    return noSignal("Custom rules need at least 55 completed candles.", "INSUFFICIENT_DATA");
  }

  const { close, atr14 } = context.indicators;
  if (close === null || atr14 === null || atr14 <= 0) {
    return noSignal("Custom rules need a valid close and ATR value.", "INSUFFICIENT_DATA");
  }

  const values = indicatorValues(context);
  const buy = matches(parsed.data.buy, values);
  const sell = matches(parsed.data.sell, values);
  if (buy === null || sell === null) {
    return noSignal("One or more configured indicators are unavailable.", "INSUFFICIENT_DATA");
  }
  if (buy === sell) {
    return noSignal(
      buy
        ? "Buy and sell rules both match; the strategy is ambiguous."
        : "No custom entry rules matched.",
    );
  }

  const direction = buy ? "BUY" : "SELL";
  const stopDistance = atr14 * parsed.data.stopLossAtr;
  const targetDistance = atr14 * parsed.data.takeProfitAtr;
  const factors = (buy ? parsed.data.buy : parsed.data.sell).map(conditionLabel);
  return {
    state: direction,
    direction,
    confidence: Math.min(90, 60 + factors.length * 5),
    reason: `All configured ${direction.toLowerCase()} rules matched using the latest completed candle.`,
    factors,
    marketState: "UNCLEAR",
    entryPrice: close,
    stopLoss: close + (direction === "BUY" ? -stopDistance : stopDistance),
    takeProfit: close + (direction === "BUY" ? targetDistance : -targetDistance),
  };
}

export const defaultCustomRules: CustomRules = {
  version: 1,
  buy: [{ left: "rsi14", operator: "gt", right: 55 }],
  sell: [{ left: "rsi14", operator: "lt", right: 45 }],
  stopLossAtr: 1.5,
  takeProfitAtr: 3,
};
