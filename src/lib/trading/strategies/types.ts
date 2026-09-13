import type { MarketCandle, NormalizedMarketData } from "../market/types";
import type { calculateIndicators } from "../indicators";

export type SignalDirection = "BUY" | "SELL" | "NONE";
export type SignalState = "NO_SIGNAL" | "BUY" | "SELL" | "WAIT" | "INSUFFICIENT_DATA" | "DATA_UNAVAILABLE" | "STRATEGY_UNAVAILABLE" | "MARKET_UNSUITABLE";
export type MarketState = "TRENDING_UP" | "TRENDING_DOWN" | "RANGING" | "BREAKOUT" | "HIGH_VOLATILITY" | "LOW_VOLATILITY" | "UNCLEAR";

export type StrategyAnalysis = {
  state: SignalState;
  direction: SignalDirection;
  confidence: number;
  reason: string;
  factors: string[];
  marketState: MarketState;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
};

export type StrategyContext = {
  botId: string;
  strategyId: string;
  symbol: string;
  timeframe: string;
  configuration: Record<string, unknown>;
  market: NormalizedMarketData;
  candles: MarketCandle[];
  indicators: ReturnType<typeof calculateIndicators>;
};

export type StrategyDefinition = {
  slug: string;
  version: string;
  analyze(context: StrategyContext): StrategyAnalysis;
};