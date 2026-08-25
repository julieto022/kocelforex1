/**
 * Provider contracts.
 *
 * Every external data source Kocel consumes is described here as an interface.
 * Application code depends on these types only, so a provider can be swapped
 * (or run in parallel behind a router) without touching feature code.
 */

export type ProviderHealth = {
  name: string;
  healthy: boolean;
  checkedAt: string;
  detail?: string;
};

export interface Provider {
  readonly name: string;
  health(): Promise<ProviderHealth>;
}

/* ------------------------------------------------------------------ News */

export type NewsItem = {
  externalId: string;
  title: string;
  summary: string | null;
  content: string | null;
  source: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  category: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  currency: string | null;
  symbols: string[];
  publishedAt: string;
};

export interface NewsProvider extends Provider {
  fetchLatest(options?: { since?: string; limit?: number }): Promise<NewsItem[]>;
}

/* ------------------------------------------------- Economic calendar */

export type EconomicEventItem = {
  externalId: string;
  eventName: string;
  country: string | null;
  currency: string;
  category: string | null;
  impact: "HIGH" | "MEDIUM" | "LOW";
  previous: string | null;
  forecast: string | null;
  actual: string | null;
  eventTime: string;
  source: string | null;
  sourceUrl: string | null;
};

export interface EconomicCalendarProvider extends Provider {
  fetchWindow(range: { from: string; to: string }): Promise<EconomicEventItem[]>;
}

/* ------------------------------------------------------------------- NFP */

export type NfpRelease = {
  releaseDate: string;
  releaseTime: string;
  previous: string | null;
  forecast: string | null;
  actual: string | null;
  source: string | null;
};

export type NfpPredictionResult = {
  prediction: string;
  confidence: number;
  confidenceBreakdown: Record<string, number>;
  factors: Array<{ name: string; value: string; signal: "BULLISH" | "BEARISH" | "NEUTRAL" }>;
  analysis: string;
  impacts: Record<"usd" | "gold" | "eurusd" | "gbpusd" | "nas100", string>;
};

export interface NfpProvider extends Provider {
  fetchSchedule(): Promise<NfpRelease[]>;
  predict(release: NfpRelease): Promise<NfpPredictionResult>;
}

/* ----------------------------------------------------------- Market data */

export type Quote = {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: string;
};

export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export interface MarketDataProvider extends Provider {
  getQuote(symbol: string): Promise<Quote | null>;
  getCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]>;
}

/* --------------------------------------------------------------- Signals */

export type SignalRequest = {
  symbol: string;
  timeframe: string;
  connectionId?: string | null;
};

export type SignalResult = {
  symbol: string;
  timeframe: string;
  direction: "BUY" | "SELL" | "WAIT" | "NO_TRADE";
  confidence: number;
  confidenceBreakdown: Record<string, number>;
  entry: number | null;
  entryZone: string | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: string | null;
  marketCondition: string | null;
  analysis: Record<string, unknown>;
  validFrom: string;
  validUntil: string;
};

export interface SignalProvider extends Provider {
  analyse(request: SignalRequest): Promise<SignalResult>;
}
