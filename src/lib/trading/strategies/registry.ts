import type { StrategyAnalysis, StrategyContext, StrategyDefinition } from "./types";

const none = (reason: string, state: StrategyAnalysis["state"] = "WAIT"): StrategyAnalysis => ({
  state, direction: "NONE", confidence: 0, reason, factors: [], marketState: "UNCLEAR", entryPrice: null, stopLoss: null, takeProfit: null,
});

function result(context: StrategyContext, direction: "BUY" | "SELL", confidence: number, reason: string, factors: string[], marketState: StrategyAnalysis["marketState"], multiple = 2): StrategyAnalysis {
  const close = context.indicators.close!;
  const atr = context.indicators.atr14 ?? Math.abs(close) * 0.001;
  return { state: direction, direction, confidence, reason, factors, marketState, entryPrice: close, stopLoss: direction === "BUY" ? close - atr * 1.5 : close + atr * 1.5, takeProfit: direction === "BUY" ? close + atr * multiple : close - atr * multiple };
}

function trendDirection(context: StrategyContext) {
  const { indicators, candles } = context;
  const close = indicators.close;
  if (close === null || indicators.ema20 === null || indicators.ema50 === null || candles.length < 50) return "NONE" as const;
  if (close > indicators.ema20 && indicators.ema20 > indicators.ema50) return "BUY" as const;
  if (close < indicators.ema20 && indicators.ema20 < indicators.ema50) return "SELL" as const;
  return "NONE" as const;
}

function microMomentum(context: StrategyContext): StrategyAnalysis {
  const { candles, indicators } = context;
  if (candles.length < 15 || indicators.momentum10 === null) return none("Micro-momentum needs recent completed candles.", "INSUFFICIENT_DATA");
  const recent = candles.slice(-3);
  const up = recent.every((candle) => candle.close > candle.open);
  const down = recent.every((candle) => candle.close < candle.open);
  const acceleration = Math.abs(recent[2]!.close - recent[2]!.open) > Math.abs(recent[0]!.close - recent[0]!.open);
  if (up && acceleration && indicators.momentum10 > 0) return result(context, "BUY", 70, "Three completed candles show accelerating bullish micro-momentum.", ["Three bullish candles", "Body acceleration", "Positive momentum"], "TRENDING_UP", 1.5);
  if (down && acceleration && indicators.momentum10 < 0) return result(context, "SELL", 70, "Three completed candles show accelerating bearish micro-momentum.", ["Three bearish candles", "Body acceleration", "Negative momentum"], "TRENDING_DOWN", 1.5);
  return none("Micro-momentum conditions are not aligned.");
}

function momentumStrategy(context: StrategyContext): StrategyAnalysis {
  const { indicators } = context;
  if (indicators.rsi14 === null || indicators.momentum10 === null) return none("Momentum needs RSI and momentum history.", "INSUFFICIENT_DATA");
  if (trendDirection(context) === "BUY" && indicators.momentum10 > 0 && indicators.rsi14 > 52 && indicators.rsi14 < 75) return result(context, "BUY", 73, "Directional momentum, EMA alignment and RSI confirmation agree.", ["Bullish EMA alignment", "Positive momentum", "RSI confirms without overbought condition"], "TRENDING_UP");
  if (trendDirection(context) === "SELL" && indicators.momentum10 < 0 && indicators.rsi14 < 48 && indicators.rsi14 > 25) return result(context, "SELL", 73, "Directional momentum, EMA alignment and RSI confirmation agree.", ["Bearish EMA alignment", "Negative momentum", "RSI confirms without oversold condition"], "TRENDING_DOWN");
  return none("Momentum direction and confirmation do not agree.");
}

function emaPullback(context: StrategyContext): StrategyAnalysis {
  const { candles, indicators } = context;
  if (candles.length < 55 || indicators.ema20 === null || indicators.ema50 === null || indicators.atr14 === null) return none("EMA pullback needs trend and pullback history.", "INSUFFICIENT_DATA");
  const current = candles.at(-1)!;
  const prior = candles.at(-2)!;
  const bullish = indicators.ema20 > indicators.ema50 && prior.low <= indicators.ema20 + indicators.atr14 * 0.25 && current.close > current.open && current.close > indicators.ema20;
  const bearish = indicators.ema20 < indicators.ema50 && prior.high >= indicators.ema20 - indicators.atr14 * 0.25 && current.close < current.open && current.close < indicators.ema20;
  if (bullish) return result(context, "BUY", 75, "Bullish EMA trend pulled back to EMA20 and rejected upward.", ["EMA20 above EMA50", "Pullback reached EMA20", "Bullish rejection close"], "TRENDING_UP");
  if (bearish) return result(context, "SELL", 75, "Bearish EMA trend pulled back to EMA20 and rejected downward.", ["EMA20 below EMA50", "Pullback reached EMA20", "Bearish rejection close"], "TRENDING_DOWN");
  return none("No confirmed EMA pullback and rejection.");
}

function breakRetest(context: StrategyContext): StrategyAnalysis {
  const { candles, indicators } = context;
  if (candles.length < 25 || indicators.atr14 === null) return none("Break and retest needs completed structure and ATR.", "INSUFFICIENT_DATA");
  const before = candles.slice(-5, -2);
  const levelHigh = Math.max(...candles.slice(-12, -5).map((candle) => candle.high));
  const levelLow = Math.min(...candles.slice(-12, -5).map((candle) => candle.low));
  const breakout = candles.at(-3)!;
  const retest = candles.at(-2)!;
  const current = candles.at(-1)!;
  if (before.length && breakout.close > levelHigh && retest.low <= levelHigh && current.close > current.open && current.close > levelHigh) return result(context, "BUY", 78, "Resistance broke, retested and produced bullish continuation.", ["Resistance close broken", "Retest held", "Continuation candle confirmed"], "BREAKOUT");
  if (before.length && breakout.close < levelLow && retest.high >= levelLow && current.close < current.open && current.close < levelLow) return result(context, "SELL", 78, "Support broke, retested and produced bearish continuation.", ["Support close broken", "Retest held", "Continuation candle confirmed"], "BREAKOUT");
  return none("No confirmed break, retest and continuation sequence.");
}

function liquiditySweep(context: StrategyContext): StrategyAnalysis {
  const { candles, indicators } = context;
  if (candles.length < 12 || indicators.atr14 === null) return none("Liquidity sweep needs swing history and ATR.", "INSUFFICIENT_DATA");
  const prior = candles.slice(-11, -1);
  const high = Math.max(...prior.map((candle) => candle.high));
  const low = Math.min(...prior.map((candle) => candle.low));
  const current = candles.at(-1)!;
  if (current.high > high && current.close < high && current.close < current.open) return result(context, "SELL", 71, "Price swept the recent high and closed back below it.", ["Recent swing high swept", "Close reclaimed below liquidity", "Bearish rejection"], "RANGING");
  if (current.low < low && current.close > low && current.close > current.open) return result(context, "BUY", 71, "Price swept the recent low and closed back above it.", ["Recent swing low swept", "Close reclaimed above liquidity", "Bullish rejection"], "RANGING");
  return none("No measurable swing liquidity sweep and rejection.");
}

function atrVolatility(context: StrategyContext): StrategyAnalysis {
  const { candles, indicators } = context;
  if (candles.length < 30 || indicators.atr14 === null) return none("ATR volatility needs a baseline range.", "INSUFFICIENT_DATA");
  const baseline = candles.slice(-29, -14).reduce((sum, candle) => sum + candle.high - candle.low, 0) / 15;
  const current = candles.at(-1)!;
  if (indicators.atr14 > baseline * 1.25 && current.close > current.open) return result(context, "BUY", 67, "Volatility expanded above its recent baseline with a bullish candle.", ["ATR above baseline", "Range expansion", "Bullish expansion candle"], "HIGH_VOLATILITY", 1.5);
  if (indicators.atr14 > baseline * 1.25 && current.close < current.open) return result(context, "SELL", 67, "Volatility expanded above its recent baseline with a bearish candle.", ["ATR above baseline", "Range expansion", "Bearish expansion candle"], "HIGH_VOLATILITY", 1.5);
  return none("Volatility is not expanding enough for an ATR strategy.", "MARKET_UNSUITABLE");
}

function sessionStrategy(context: StrategyContext): StrategyAnalysis {
  const hour = new Date(context.candles.at(-1)?.timestamp ?? 0).getUTCHours();
  if (![7, 8, 9, 13, 14, 15].includes(hour)) return none("The latest completed candle is outside the configured active session.", "MARKET_UNSUITABLE");
  const direction = trendDirection(context);
  if (direction === "BUY") return result(context, "BUY", 64, "Bullish setup confirmed during an active London/New York UTC window.", ["Active UTC session", "Bullish trend alignment"], "TRENDING_UP", 1.5);
  if (direction === "SELL") return result(context, "SELL", 64, "Bearish setup confirmed during an active London/New York UTC window.", ["Active UTC session", "Bearish trend alignment"], "TRENDING_DOWN", 1.5);
  return none("Session is active but direction is unclear.");
}

function trendFollowing(context: StrategyContext): StrategyAnalysis {
  const { candles, indicators } = context;
  if (candles.length < 55 || indicators.ema20 === null || indicators.ema50 === null || indicators.momentum10 === null) return none("Trend following needs long EMA and structure history.", "INSUFFICIENT_DATA");
  const highs = candles.slice(-5).map((candle) => candle.high);
  const lows = candles.slice(-5).map((candle) => candle.low);
  const higherStructure = highs.every((value, index) => index === 0 || value >= highs[index - 1]!);
  const lowerStructure = lows.every((value, index) => index === 0 || value <= lows[index - 1]!);
  if (indicators.ema20 > indicators.ema50 && indicators.momentum10 > 0 && higherStructure) return result(context, "BUY", 80, "EMA alignment, positive slope proxy and higher-high structure confirm the trend.", ["EMA20 above EMA50", "Positive momentum", "Higher-high structure"], "TRENDING_UP", 2.5);
  if (indicators.ema20 < indicators.ema50 && indicators.momentum10 < 0 && lowerStructure) return result(context, "SELL", 80, "EMA alignment, negative slope proxy and lower-low structure confirm the trend.", ["EMA20 below EMA50", "Negative momentum", "Lower-low structure"], "TRENDING_DOWN", 2.5);
  return none("Trend alignment, momentum and structure are not simultaneously confirmed.");
}

function higherTimeframeTrend(context: StrategyContext, name: string, minimum: number, multiple: number): StrategyAnalysis {
  const { indicators } = context;
  if (context.candles.length < 55 || indicators.ema20 === null || indicators.ema50 === null || indicators.momentum10 === null) return none(`${name} needs higher-timeframe history.`, "INSUFFICIENT_DATA");
  if (indicators.ema20 > indicators.ema50 && indicators.momentum10 > 0) return result(context, "BUY", minimum, `${name} confirms a longer-horizon bullish structure and momentum.`, ["Long EMA alignment", "Positive broader momentum", "Higher-timeframe context available"], "TRENDING_UP", multiple);
  if (indicators.ema20 < indicators.ema50 && indicators.momentum10 < 0) return result(context, "SELL", minimum, `${name} confirms a longer-horizon bearish structure and momentum.`, ["Long EMA alignment", "Negative broader momentum", "Higher-timeframe context available"], "TRENDING_DOWN", multiple);
  return none(`${name} has no confirmed directional setup.`);
}

function kocelAiScalper(context: StrategyContext): StrategyAnalysis {
  const { indicators } = context;
  if (context.candles.length < 55 || indicators.rsi14 === null || indicators.atr14 === null) return none("Kocel AI Scalper needs sufficient multi-factor history.", "INSUFFICIENT_DATA");
  const trend = trendDirection(context);
  const momentumScore = (indicators.momentum10 ?? 0) > 0 ? 1 : (indicators.momentum10 ?? 0) < 0 ? -1 : 0;
  const structureScore = context.candles.at(-1)!.close > (indicators.sma20 ?? context.candles.at(-1)!.close) ? 1 : -1;
  const priceActionScore = context.candles.at(-1)!.close > context.candles.at(-1)!.open ? 1 : -1;
  const buyScore = (trend === "BUY" ? 20 : 0) + (momentumScore > 0 ? 20 : 0) + (structureScore > 0 ? 20 : 0) + (indicators.rsi14 > 50 ? 15 : 0) + (priceActionScore > 0 ? 15 : 0) + 10;
  const sellScore = (trend === "SELL" ? 20 : 0) + (momentumScore < 0 ? 20 : 0) + (structureScore < 0 ? 20 : 0) + (indicators.rsi14 < 50 ? 15 : 0) + (priceActionScore < 0 ? 15 : 0) + 10;
  if (buyScore >= 60 && buyScore - sellScore >= 15) return result(context, "BUY", buyScore, "Transparent multi-factor scoring confirms a bullish setup.", [`Trend score: ${trend === "BUY" ? 20 : 0}/20`, `Momentum score: ${momentumScore > 0 ? 20 : 0}/20`, `Structure score: ${structureScore > 0 ? 20 : 0}/20`, `Price action score: ${priceActionScore > 0 ? 15 : 0}/15`, "Session score: 10/10"], "TRENDING_UP");
  if (sellScore >= 60 && sellScore - buyScore >= 15) return result(context, "SELL", sellScore, "Transparent multi-factor scoring confirms a bearish setup.", [`Trend score: ${trend === "SELL" ? 20 : 0}/20`, `Momentum score: ${momentumScore < 0 ? 20 : 0}/20`, `Structure score: ${structureScore < 0 ? 20 : 0}/20`, `Price action score: ${priceActionScore < 0 ? 15 : 0}/15`, "Session score: 10/10"], "TRENDING_DOWN");
  return none(`Multi-factor scores conflict (BUY ${buyScore}, SELL ${sellScore}).`);
}

function scalping(context: StrategyContext): StrategyAnalysis {
  const configured = String(context.configuration.subStrategy ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  const evaluators: Record<string, (value: StrategyContext) => StrategyAnalysis> = {
    "micro-momentum": microMomentum,
    momentum: momentumStrategy,
    "ema-pullback": emaPullback,
    "price-action": priceAction,
    "break-retest": breakRetest,
    "liquidity-sweep": liquiditySweep,
    vwap: (value) => getStrategyDefinition("vwap")!.analyze(value),
    "atr-volatility": atrVolatility,
    session: sessionStrategy,
    range,
  };
  const evaluator = evaluators[configured];
  return evaluator ? evaluator(context) : none("Scalping sub-strategy is not configured.", "DATA_UNAVAILABLE");
}

function range(context: StrategyContext): StrategyAnalysis {
  const { indicators } = context;
  if (indicators.close === null || indicators.highestHigh20 === null || indicators.lowestLow20 === null || indicators.atr14 === null) return none("Range analysis needs completed candles and ATR.", "INSUFFICIENT_DATA");
  const width = indicators.highestHigh20 - indicators.lowestLow20;
  const nearLow = indicators.close <= indicators.lowestLow20 + width * 0.2;
  const nearHigh = indicators.close >= indicators.highestHigh20 - width * 0.2;
  if (nearLow) return { state: "BUY", direction: "BUY", confidence: 68, reason: "Price is near the measured range low with room toward the midpoint.", factors: ["Range boundary identified", "Price near support", "Mid-range avoidance passed"], marketState: "RANGING", entryPrice: indicators.close, stopLoss: indicators.close - indicators.atr14, takeProfit: indicators.close + width * 0.35 };
  if (nearHigh) return { state: "SELL", direction: "SELL", confidence: 68, reason: "Price is near the measured range high with room toward the midpoint.", factors: ["Range boundary identified", "Price near resistance", "Mid-range avoidance passed"], marketState: "RANGING", entryPrice: indicators.close, stopLoss: indicators.close + indicators.atr14, takeProfit: indicators.close - width * 0.35 };
  return none("Price is near the range midpoint; no range entry is suitable.", "MARKET_UNSUITABLE");
}

function breakout(context: StrategyContext): StrategyAnalysis {
  const { indicators, candles } = context;
  if (indicators.close === null || indicators.highestHigh20 === null || indicators.lowestLow20 === null || indicators.atr14 === null || candles.length < 22) return none("Breakout analysis needs completed structure and ATR.", "INSUFFICIENT_DATA");
  const prior = candles.slice(-21, -1);
  const high = Math.max(...prior.map((candle) => candle.high));
  const low = Math.min(...prior.map((candle) => candle.low));
  const last = candles.at(-1)!;
  if (last.close > high && last.close - high >= indicators.atr14 * 0.1) return { state: "BUY", direction: "BUY", confidence: 72, reason: "A candle closed beyond the recent structure high with volatility confirmation.", factors: ["Structure high broken", "Close confirmed beyond level", "ATR expansion filter passed"], marketState: "BREAKOUT", entryPrice: last.close, stopLoss: high - indicators.atr14, takeProfit: last.close + indicators.atr14 * 2 };
  if (last.close < low && low - last.close >= indicators.atr14 * 0.1) return { state: "SELL", direction: "SELL", confidence: 72, reason: "A candle closed beyond the recent structure low with volatility confirmation.", factors: ["Structure low broken", "Close confirmed beyond level", "ATR expansion filter passed"], marketState: "BREAKOUT", entryPrice: last.close, stopLoss: low + indicators.atr14, takeProfit: last.close - indicators.atr14 * 2 };
  return none("No confirmed close beyond a meaningful structure boundary.");
}

function priceAction(context: StrategyContext): StrategyAnalysis {
  if (context.candles.length < 2) return none("Price action needs at least two completed candles.", "INSUFFICIENT_DATA");
  const current = context.candles.at(-1)!;
  const previous = context.candles.at(-2)!;
  const currentBody = Math.abs(current.close - current.open);
  const previousBody = Math.abs(previous.close - previous.open);
  const bullishEngulfing = previous.close < previous.open && current.close > current.open && current.open <= previous.close && current.close >= previous.open;
  const bearishEngulfing = previous.close > previous.open && current.close < current.open && current.open >= previous.close && current.close <= previous.open;
  if (bullishEngulfing && currentBody >= previousBody) return { state: "BUY", direction: "BUY", confidence: 66, reason: "A bullish engulfing candle confirmed a stronger body than the prior candle.", factors: ["Bullish engulfing", "Strong body confirmation"], marketState: "UNCLEAR", entryPrice: current.close, stopLoss: current.low, takeProfit: current.close + currentBody * 2 };
  if (bearishEngulfing && currentBody >= previousBody) return { state: "SELL", direction: "SELL", confidence: 66, reason: "A bearish engulfing candle confirmed a stronger body than the prior candle.", factors: ["Bearish engulfing", "Strong body confirmation"], marketState: "UNCLEAR", entryPrice: current.close, stopLoss: current.high, takeProfit: current.close - currentBody * 2 };
  return none("No supported price-action confirmation is present.");
}

const definitions: StrategyDefinition[] = [
  { slug: "scalping", version: "1.0", analyze: scalping },
  { slug: "micro-momentum", version: "1.0", analyze: microMomentum },
  { slug: "momentum", version: "1.0", analyze: momentumStrategy },
  { slug: "ema-pullback", version: "1.0", analyze: emaPullback },
  { slug: "break-retest", version: "1.0", analyze: breakRetest },
  { slug: "liquidity-sweep", version: "1.0", analyze: liquiditySweep },
  { slug: "atr-volatility", version: "1.0", analyze: atrVolatility },
  { slug: "session", version: "1.0", analyze: sessionStrategy },
  { slug: "day-trading", version: "1.0", analyze: (context) => trendFollowing(context) },
  { slug: "swing-trading", version: "1.0", analyze: (context) => higherTimeframeTrend(context, "Swing Trading", 76, 2.5) },
  { slug: "position-trading", version: "1.0", analyze: (context) => higherTimeframeTrend(context, "Position Trading", 78, 3) },
  { slug: "trend-following", version: "1.0", analyze: trendFollowing },
  { slug: "kocel-ai-scalper", version: "1.0", analyze: kocelAiScalper },
  { slug: "price-action", version: "1.0", analyze: priceAction },
  { slug: "price-action-framework", version: "1.0", analyze: priceAction },
  { slug: "range", version: "1.0", analyze: range },
  { slug: "range-trading", version: "1.0", analyze: range },
  { slug: "breakout", version: "1.0", analyze: breakout },
  { slug: "vwap", version: "1.0", analyze: (context) => {
    const { indicators } = context;
    if (indicators.vwap === null || indicators.close === null) return none("VWAP is unavailable because usable volume was not supplied.", "DATA_UNAVAILABLE");
    if (indicators.close > indicators.vwap && context.candles.at(-1)!.close > context.candles.at(-1)!.open) return result(context, "BUY", 69, "Price reclaimed VWAP with a bullish completed candle.", ["VWAP available", "Price above VWAP", "Bullish reclaim candle"], "TRENDING_UP", 1.5);
    if (indicators.close < indicators.vwap && context.candles.at(-1)!.close < context.candles.at(-1)!.open) return result(context, "SELL", 69, "Price rejected VWAP with a bearish completed candle.", ["VWAP available", "Price below VWAP", "Bearish rejection candle"], "TRENDING_DOWN", 1.5);
    return none("Price/VWAP direction is not confirmed.");
  } },
  { slug: "nfp-news-trading", version: "1.0", analyze: () => none("NEWS_DATA_UNAVAILABLE", "DATA_UNAVAILABLE") },
  { slug: "carry", version: "1.0", analyze: () => none("DATA_UNAVAILABLE: real rate or swap data is required.", "DATA_UNAVAILABLE") },
  { slug: "grid", version: "1.0", analyze: (context) => ({ ...range(context), reason: "Grid suitability analyzed; no orders are created in this phase.", state: "WAIT", direction: "NONE" }) },
  { slug: "algorithmic-hft", version: "1.0", analyze: () => none("UNSUPPORTED: institutional latency guarantees are unavailable.", "STRATEGY_UNAVAILABLE") },
];

const registry = new Map(definitions.map((definition) => [definition.slug, definition]));
export function getStrategyDefinition(slug: string): StrategyDefinition | null { return registry.get(slug) ?? null; }
export function listStrategyDefinitions(): StrategyDefinition[] { return [...registry.values()]; }