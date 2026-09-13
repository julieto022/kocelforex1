import { describe, expect, it } from "vitest";

import { extractSupabaseErrorMeta, validateBotInput } from "./bots";

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

  it("accepts broker-specific symbol suffixes and punctuation", () => {
    expect(
      validateBotInput({
        name: "Gold Bot",
        symbol: "XAUUSDm",
        strategyId: "550e8400-e29b-41d4-a716-446655440000",
        connectionId: "550e8400-e29b-41d4-a716-446655440001",
      }),
    ).toMatchObject({ ok: true });

    expect(
      validateBotInput({
        name: "Index Bot",
        symbol: "NAS100.cash",
        strategyId: "550e8400-e29b-41d4-a716-446655440000",
        connectionId: "550e8400-e29b-41d4-a716-446655440001",
      }),
    ).toMatchObject({ ok: true });
  });

  it("extracts the exact supabase error metadata for bot query failures", () => {
    expect(
      extractSupabaseErrorMeta({
        code: "PGRST205",
        message: "Could not find the table 'public.bots' in the schema cache",
        details: "The table does not exist",
        hint: "Create the table or update the schema cache.",
        status: 404,
      }),
    ).toEqual({
      code: "PGRST205",
      message: "Could not find the table 'public.bots' in the schema cache",
      details: "The table does not exist",
      hint: "Create the table or update the schema cache.",
      status: 404,
    });
  });
});
