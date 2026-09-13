import type { MarketState, SignalDirection, SignalState } from "../strategies/types";

export type TradingSignal = {
  id: string;
  botId: string;
  strategyId: string;
  connectionId: string;
  symbol: string;
  timeframe: string;
  timestamp: string;
  direction: SignalDirection;
  state: SignalState;
  confidence: number;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  reason: string;
  factors: string[];
  marketState: MarketState;
  dataTimestamp: string | null;
  dataStatus: "FRESH" | "STALE" | "UNAVAILABLE";
  strategyVersion: string;
};