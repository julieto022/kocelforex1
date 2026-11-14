import { calculateIndicators } from "../indicators";
import {
  isTradingTimeframe,
  validateMarketCandles,
  type MarketCandle,
  type NormalizedMarketData,
} from "../market/types";
import type { StrategyAnalysis, StrategyDefinition } from "../strategies/types";

export const BACKTEST_ENGINE_VERSION = "1.1.0";
const STRATEGY_CONTEXT_CANDLES = 55;

export type BacktestSettings = {
  initialBalance: number;
  riskPercent: number;
  spread: number;
  slippage: number;
};

export type BacktestTrade = {
  direction: "BUY" | "SELL";
  openedAt: string;
  closedAt: string;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  rMultiple: number;
  profit: number;
  balanceAfter: number;
  exitReason: "STOP_LOSS" | "TAKE_PROFIT" | "END_OF_TEST";
};

export type BacktestEquityPoint = {
  timestamp: string;
  balance: number;
};

export type BacktestMetrics = {
  initialBalance: number;
  finalBalance: number;
  netProfit: number;
  returnPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number | null;
  expectancy: number;
  averageWin: number;
  averageLoss: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxLosingStreak: number;
};

export type BacktestResult = {
  metrics: BacktestMetrics;
  equityCurve: BacktestEquityPoint[];
  trades: BacktestTrade[];
};

export function simulateBacktest(input: {
  strategy: StrategyDefinition;
  strategyId: string;
  symbol: string;
  timeframe: string;
  configuration: Record<string, unknown>;
  candles: MarketCandle[];
  settings: BacktestSettings;
  startAt: string;
  endAt: string;
}): BacktestResult {
  const { candles, settings } = input;
  const startMs = Date.parse(input.startAt);
  const endMs = Date.parse(input.endAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    throw new Error("Backtest date range is invalid.");
  }
  if (!isTradingTimeframe(input.timeframe)) {
    throw new Error("Backtest timeframe is not supported.");
  }
  if (candles.length < 55 || !validateMarketCandles(candles, 55).ok) {
    throw new Error("At least 55 valid, chronological EA-synced candles are required.");
  }
  if (
    !Number.isFinite(settings.initialBalance) ||
    settings.initialBalance <= 0 ||
    !Number.isFinite(settings.riskPercent) ||
    settings.riskPercent <= 0 ||
    settings.riskPercent > 5 ||
    !Number.isFinite(settings.spread) ||
    settings.spread < 0 ||
    !Number.isFinite(settings.slippage) ||
    settings.slippage < 0
  ) {
    throw new Error("Backtest settings are outside the allowed range.");
  }

  const firstInRange = candles.findIndex((candle) => Date.parse(candle.timestamp) >= startMs);
  if (firstInRange < 0 || Date.parse(candles.at(-1)!.timestamp) < startMs) {
    throw new Error("No EA-synced candles are available in the selected date range.");
  }

  let balance = settings.initialBalance;
  let peak = balance;
  let maximumDrawdown = 0;
  let maximumDrawdownPercent = 0;
  let currentLosingStreak = 0;
  let maximumLosingStreak = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  const equityCurve: BacktestEquityPoint[] = [
    { timestamp: candles[firstInRange]!.timestamp, balance },
  ];
  const trades: BacktestTrade[] = [];
  let openTrade: {
    direction: "BUY" | "SELL";
    openedAt: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    riskAmount: number;
  } | null = null;
  const executionCost = settings.spread / 2 + settings.slippage;

  const closeTrade = (
    timestamp: string,
    referencePrice: number,
    reason: BacktestTrade["exitReason"],
  ) => {
    if (!openTrade) return;
    const sign = openTrade.direction === "BUY" ? 1 : -1;
    const exitPrice = referencePrice - sign * executionCost;
    const riskDistance = Math.abs(openTrade.entryPrice - openTrade.stopLoss);
    const rMultiple = (sign * (exitPrice - openTrade.entryPrice)) / riskDistance;
    const profit = openTrade.riskAmount * rMultiple;
    balance = Math.max(0, balance + profit);
    if (profit > 0) {
      grossProfit += profit;
      currentLosingStreak = 0;
    } else {
      grossLoss += Math.abs(profit);
      currentLosingStreak += 1;
      maximumLosingStreak = Math.max(maximumLosingStreak, currentLosingStreak);
    }
    peak = Math.max(peak, balance);
    const drawdown = peak - balance;
    maximumDrawdown = Math.max(maximumDrawdown, drawdown);
    maximumDrawdownPercent = Math.max(
      maximumDrawdownPercent,
      peak > 0 ? (drawdown / peak) * 100 : 0,
    );
    trades.push({
      direction: openTrade.direction,
      openedAt: openTrade.openedAt,
      closedAt: timestamp,
      entryPrice: openTrade.entryPrice,
      exitPrice,
      stopLoss: openTrade.stopLoss,
      takeProfit: openTrade.takeProfit,
      riskAmount: openTrade.riskAmount,
      rMultiple,
      profit,
      balanceAfter: balance,
      exitReason: reason,
    });
    equityCurve.push({ timestamp, balance });
    openTrade = null;
  };

  for (let index = Math.max(54, firstInRange); index < candles.length; index += 1) {
    const candle = candles[index]!;
    const timestamp = Date.parse(candle.timestamp);
    if (timestamp > endMs) break;

    if (openTrade) {
      const stopHit =
        openTrade.direction === "BUY"
          ? candle.low <= openTrade.stopLoss
          : candle.high >= openTrade.stopLoss;
      const targetHit =
        openTrade.direction === "BUY"
          ? candle.high >= openTrade.takeProfit
          : candle.low <= openTrade.takeProfit;
      if (stopHit) {
        closeTrade(candle.timestamp, openTrade.stopLoss, "STOP_LOSS");
      } else if (targetHit) {
        closeTrade(candle.timestamp, openTrade.takeProfit, "TAKE_PROFIT");
      }
    }

    const nextCandle = candles[index + 1];
    if (openTrade || !nextCandle || Date.parse(nextCandle.timestamp) > endMs) continue;

    const history = candles.slice(Math.max(0, index - STRATEGY_CONTEXT_CANDLES + 1), index + 1);
    const market: NormalizedMarketData = {
      symbol: input.symbol.trim(),
      timeframe: input.timeframe,
      candles: history,
      quality: { ok: true, code: "OK", message: "Market candles are valid." },
      latestTimestamp: history.at(-1)?.timestamp ?? null,
    };
    const analysis: StrategyAnalysis = input.strategy.analyze({
      botId: "backtest",
      strategyId: input.strategyId,
      symbol: input.symbol,
      timeframe: input.timeframe,
      configuration: input.configuration,
      market,
      candles: history,
      indicators: calculateIndicators(history),
    });
    if (
      (analysis.direction !== "BUY" && analysis.direction !== "SELL") ||
      analysis.stopLoss === null ||
      analysis.takeProfit === null ||
      !Number.isFinite(analysis.stopLoss) ||
      !Number.isFinite(analysis.takeProfit)
    ) {
      continue;
    }

    const direction = analysis.direction;
    const sign = direction === "BUY" ? 1 : -1;
    const entryPrice = nextCandle.open + sign * executionCost;
    const validLevels =
      direction === "BUY"
        ? analysis.stopLoss < entryPrice && analysis.takeProfit > entryPrice
        : analysis.stopLoss > entryPrice && analysis.takeProfit < entryPrice;
    if (!validLevels) continue;

    openTrade = {
      direction,
      openedAt: nextCandle.timestamp,
      entryPrice,
      stopLoss: analysis.stopLoss,
      takeProfit: analysis.takeProfit,
      riskAmount: balance * (settings.riskPercent / 100),
    };
  }

  if (openTrade) {
    const lastCandle = candles.filter((candle) => Date.parse(candle.timestamp) <= endMs).at(-1);
    if (lastCandle) closeTrade(lastCandle.timestamp, lastCandle.close, "END_OF_TEST");
  }

  const wins = trades.filter((trade) => trade.profit > 0);
  const losses = trades.filter((trade) => trade.profit <= 0);
  return {
    metrics: {
      initialBalance: settings.initialBalance,
      finalBalance: balance,
      netProfit: balance - settings.initialBalance,
      returnPercent: ((balance - settings.initialBalance) / settings.initialBalance) * 100,
      totalTrades: trades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
      expectancy: trades.length ? (balance - settings.initialBalance) / trades.length : 0,
      averageWin: wins.length ? grossProfit / wins.length : 0,
      averageLoss: losses.length ? -grossLoss / losses.length : 0,
      maxDrawdown: maximumDrawdown,
      maxDrawdownPercent: maximumDrawdownPercent,
      maxLosingStreak: maximumLosingStreak,
    },
    equityCurve,
    trades,
  };
}
