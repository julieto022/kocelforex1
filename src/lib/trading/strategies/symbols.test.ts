import { describe, expect, it } from "vitest";

import { isStrategySymbolAllowed } from "./symbols";

describe("isStrategySymbolAllowed", () => {
  it("allows unrestricted strategies and wildcard targets", () => {
    expect(isStrategySymbolAllowed({}, "EURUSD")).toBe(true);
    expect(isStrategySymbolAllowed({ targetSymbols: ["*"] }, "XAUUSD")).toBe(true);
  });

  it("matches a configured target without regard to symbol casing", () => {
    expect(isStrategySymbolAllowed({ targetSymbols: ["EURUSD"] }, "eurusd")).toBe(true);
    expect(isStrategySymbolAllowed({ targetSymbols: ["EURUSD"] }, "GBPUSD")).toBe(false);
  });
});
