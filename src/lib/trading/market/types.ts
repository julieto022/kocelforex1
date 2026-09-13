export const SUPPORTED_TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"] as const;
export type TradingTimeframe = (typeof SUPPORTED_TIMEFRAMES)[number];

export type MarketCandle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

export type MarketTick = {
  timestamp: string;
  bid: number;
  ask: number;
  last?: number | null;
  volume?: number | null;
};

export type MarketDataQualityCode =
  | "OK"
  | "INVALID_TIMEFRAME"
  | "INSUFFICIENT_DATA"
  | "INVALID_TIMESTAMP"
  | "OUT_OF_ORDER"
  | "DUPLICATE_TIMESTAMP"
  | "INVALID_OHLC"
  | "NEGATIVE_PRICE";

export type MarketDataQuality = {
  ok: boolean;
  code: MarketDataQualityCode;
  message: string;
};

export type NormalizedMarketData = {
  symbol: string;
  timeframe: TradingTimeframe;
  candles: MarketCandle[];
  quality: MarketDataQuality;
  latestTimestamp: string | null;
};

export function isTradingTimeframe(value: string | null | undefined): value is TradingTimeframe {
  return SUPPORTED_TIMEFRAMES.includes(value as TradingTimeframe);
}

export function validateMarketCandles(candles: MarketCandle[], minimum = 2): MarketDataQuality {
  if (candles.length < minimum) {
    return { ok: false, code: "INSUFFICIENT_DATA", message: `At least ${minimum} completed candles are required.` };
  }

  let previousTimestamp = -Infinity;
  for (const candle of candles) {
    const timestamp = Date.parse(candle.timestamp);
    if (!Number.isFinite(timestamp)) {
      return { ok: false, code: "INVALID_TIMESTAMP", message: "Every candle must have a valid timestamp." };
    }
    if (timestamp === previousTimestamp) {
      return { ok: false, code: "DUPLICATE_TIMESTAMP", message: "Candle timestamps must be unique." };
    }
    if (timestamp < previousTimestamp) {
      return { ok: false, code: "OUT_OF_ORDER", message: "Candles must be chronological." };
    }
    previousTimestamp = timestamp;
    const values = [candle.open, candle.high, candle.low, candle.close];
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      return { ok: false, code: "NEGATIVE_PRICE", message: "Candle prices must be finite and non-negative." };
    }
    if (candle.high < candle.open || candle.high < candle.close || candle.low > candle.open || candle.low > candle.close || candle.low > candle.high) {
      return { ok: false, code: "INVALID_OHLC", message: "Candle OHLC relationships are invalid." };
    }
    if (candle.volume !== undefined && candle.volume !== null && (!Number.isFinite(candle.volume) || candle.volume < 0)) {
      return { ok: false, code: "INVALID_OHLC", message: "Candle volume must be finite and non-negative." };
    }
  }
  return { ok: true, code: "OK", message: "Market candles are valid." };
}

export function normalizeMarketData(
  symbol: string,
  timeframe: string,
  candles: MarketCandle[],
  minimum = 2,
): NormalizedMarketData {
  const quality = isTradingTimeframe(timeframe)
    ? validateMarketCandles(candles, minimum)
    : { ok: false, code: "INVALID_TIMEFRAME" as const, message: "Unsupported timeframe." };
  return {
    symbol: symbol.trim(),
    timeframe: timeframe as TradingTimeframe,
    candles,
    quality,
    latestTimestamp: candles.at(-1)?.timestamp ?? null,
  };
}