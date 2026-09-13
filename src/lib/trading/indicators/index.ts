import type { MarketCandle } from "../market/types";

export type IndicatorValue = number | null;
export type MacdValue = { macd: number; signal: number; histogram: number } | null;

function closes(candles: MarketCandle[]) { return candles.map((candle) => candle.close); }

export function sma(values: number[], period: number): IndicatorValue {
  if (period < 1 || values.length < period) return null;
  return values.slice(-period).reduce((sum, value) => sum + value, 0) / period;
}

export function ema(values: number[], period: number): IndicatorValue {
  if (period < 1 || values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (const value of values.slice(period)) current = (value - current) * multiplier + current;
  return current;
}

export function rsi(values: number[], period = 14): IndicatorValue {
  if (period < 1 || values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = values[index]! - values[index - 1]!;
    if (change >= 0) gains += change; else losses -= change;
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;
  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index]! - values[index - 1]!;
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (averageLoss === 0) return 100;
  return 100 - 100 / (1 + averageGain / averageLoss);
}

export function atr(candles: MarketCandle[], period = 14): IndicatorValue {
  if (period < 1 || candles.length <= period) return null;
  const ranges = candles.slice(1).map((candle, index) => Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - candles[index]!.close),
    Math.abs(candle.low - candles[index]!.close),
  ));
  return sma(ranges, period);
}

export function standardDeviation(values: number[], period: number): IndicatorValue {
  if (period < 1 || values.length < period) return null;
  const sample = values.slice(-period);
  const mean = sample.reduce((sum, value) => sum + value, 0) / period;
  return Math.sqrt(sample.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period);
}

export function momentum(values: number[], period = 10): IndicatorValue {
  if (period < 1 || values.length <= period) return null;
  return values.at(-1)! - values.at(-(period + 1))!;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9): MacdValue {
  if (values.length < slow + signal - 1) return null;
  const macdSeries: number[] = [];
  for (let index = slow; index <= values.length; index += 1) {
    const sample = values.slice(0, index);
    macdSeries.push(ema(sample, fast)! - ema(sample, slow)!);
  }
  const current = macdSeries.at(-1)!;
  const signalValue = ema(macdSeries, signal);
  return signalValue === null ? null : { macd: current, signal: signalValue, histogram: current - signalValue };
}

export function highestHigh(candles: MarketCandle[], period: number): IndicatorValue {
  if (period < 1 || candles.length < period) return null;
  return Math.max(...candles.slice(-period).map((candle) => candle.high));
}

export function lowestLow(candles: MarketCandle[], period: number): IndicatorValue {
  if (period < 1 || candles.length < period) return null;
  return Math.min(...candles.slice(-period).map((candle) => candle.low));
}

export function averageRange(candles: MarketCandle[], period: number): IndicatorValue {
  return sma(candles.map((candle) => candle.high - candle.low), period);
}

export function vwap(candles: MarketCandle[]): IndicatorValue {
  if (candles.length === 0 || candles.some((candle) => candle.volume === undefined || candle.volume === null || candle.volume <= 0)) return null;
  const totals = candles.reduce((result, candle) => {
    const typical = (candle.high + candle.low + candle.close) / 3;
    result.volume += candle.volume!;
    result.value += typical * candle.volume!;
    return result;
  }, { value: 0, volume: 0 });
  return totals.volume > 0 ? totals.value / totals.volume : null;
}

export function calculateIndicators(candles: MarketCandle[]) {
  const values = closes(candles);
  return {
    close: values.at(-1) ?? null,
    sma20: sma(values, 20),
    ema9: ema(values, 9),
    ema20: ema(values, 20),
    ema50: ema(values, 50),
    rsi14: rsi(values),
    macd: macd(values),
    momentum10: momentum(values),
    atr14: atr(candles),
    standardDeviation20: standardDeviation(values, 20),
    highestHigh20: highestHigh(candles, 20),
    lowestLow20: lowestLow(candles, 20),
    averageRange14: averageRange(candles, 14),
    vwap: vwap(candles),
  };
}