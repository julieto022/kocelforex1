import { describe, expect, it } from "vitest";

import { isTradableAutomationSignal } from "./automation";

const signal = {
  dataStatus: "FRESH",
  dataTimestamp: "2026-11-13T12:00:00.000Z",
  direction: "BUY",
  entryPrice: 100,
  stopLoss: 95,
  takeProfit: 110,
} as const;

describe("isTradableAutomationSignal", () => {
  it("allows fresh buy and sell signals with protective exits on the correct side", () => {
    expect(isTradableAutomationSignal(signal)).toBe(true);
    expect(
      isTradableAutomationSignal({
        ...signal,
        direction: "SELL",
        stopLoss: 105,
        takeProfit: 90,
      }),
    ).toBe(true);
  });

  it("rejects stale, incomplete, or incorrectly placed stop and target prices", () => {
    expect(isTradableAutomationSignal({ ...signal, dataStatus: "STALE" })).toBe(false);
    expect(isTradableAutomationSignal({ ...signal, dataTimestamp: null })).toBe(false);
    expect(isTradableAutomationSignal({ ...signal, stopLoss: null })).toBe(false);
    expect(isTradableAutomationSignal({ ...signal, stopLoss: 105 })).toBe(false);
    expect(isTradableAutomationSignal({ ...signal, entryPrice: Number.NaN })).toBe(false);
  });
});
