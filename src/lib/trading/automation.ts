import type { TradingSignal } from "@/lib/trading/signals/types";

type AutomationSignal = Pick<
  TradingSignal,
  "dataStatus" | "dataTimestamp" | "direction" | "entryPrice" | "stopLoss" | "takeProfit"
>;

type TradableAutomationSignal = AutomationSignal & {
  dataStatus: "FRESH";
  dataTimestamp: string;
  direction: "BUY" | "SELL";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
};

export function isTradableAutomationSignal(
  signal: AutomationSignal,
): signal is TradableAutomationSignal {
  if (
    signal.dataStatus !== "FRESH" ||
    !signal.dataTimestamp ||
    (signal.direction !== "BUY" && signal.direction !== "SELL") ||
    signal.entryPrice === null ||
    signal.stopLoss === null ||
    signal.takeProfit === null
  ) {
    return false;
  }

  const { entryPrice, stopLoss, takeProfit, direction } = signal;
  if (![entryPrice, stopLoss, takeProfit].every(Number.isFinite)) return false;
  return direction === "BUY"
    ? stopLoss < entryPrice && takeProfit > entryPrice
    : stopLoss > entryPrice && takeProfit < entryPrice;
}
