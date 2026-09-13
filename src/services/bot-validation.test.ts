import { describe, expect, it } from "vitest";

import { validateBotInput } from "./bots";

describe("bot validation", () => {
  it("requires a bot name, a strategy, and an MT5 connection", () => {
    expect(
      validateBotInput({
        name: "   ",
        symbol: "BTCUSD",
        strategyId: "",
        connectionId: "",
      }),
    ).toMatchObject({
      ok: false,
      message: "Enter a bot name, choose one strategy, and select an MT5 account.",
    });
  });

  it("accepts a valid single-strategy bot payload", () => {
    expect(
      validateBotInput({
        name: "Momentum Bot",
        symbol: "BTCUSD",
        strategyId: "550e8400-e29b-41d4-a716-446655440000",
        connectionId: "550e8400-e29b-41d4-a716-446655440001",
      }),
    ).toMatchObject({ ok: true });
  });
});
