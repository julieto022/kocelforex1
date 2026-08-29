import { describe, expect, it } from "vitest";

import { validateBridgeHeartbeat } from "./bridge.server";

describe("bridge heartbeat validation", () => {
  it("accepts a valid MT5 snapshot with positions and orders", () => {
    const payload = {
      status: "CONNECTED" as const,
      account: {
        balance: 12000.25,
        equity: 12350.5,
        margin: 4800,
        freeMargin: 7550.5,
        marginLevel: 256.4,
        currency: "USD",
        leverage: 100,
        credit: 0,
        profit: 350.25,
      },
      positions: [
        {
          ticket: 123456,
          symbol: "EURUSD",
          type: "BUY",
          volume: 0.2,
          openPrice: 1.0852,
          currentPrice: 1.0884,
          stopLoss: 1.08,
          takeProfit: 1.095,
          currentProfit: 25.5,
          swap: 0.12,
          magic: 202,
          openTime: "2026-08-29T10:00:00.000Z",
        },
      ],
      orders: [
        {
          ticket: 654321,
          symbol: "GBPUSD",
          type: "BUY_LIMIT",
          volume: 0.1,
          price: 1.27,
          stopLoss: 1.26,
          takeProfit: 1.29,
          currentState: "PLACED",
          magic: 202,
          createdAt: "2026-08-29T10:05:00.000Z",
        },
      ],
      message: "Live sync",
    };

    expect(() => validateBridgeHeartbeat(payload)).not.toThrow();
    expect(validateBridgeHeartbeat(payload)).toMatchObject({
      status: "CONNECTED",
      account: expect.objectContaining({ currency: "USD", leverage: 100 }),
      positions: expect.arrayContaining([
        expect.objectContaining({ symbol: "EURUSD", type: "BUY" }),
      ]),
      orders: expect.arrayContaining([
        expect.objectContaining({ symbol: "GBPUSD", type: "BUY_LIMIT" }),
      ]),
    });
  });

  it("rejects malformed values and invalid volume data", () => {
    const invalid = {
      status: "CONNECTED" as const,
      account: {
        balance: Number.POSITIVE_INFINITY,
        equity: -1,
        margin: 100,
        freeMargin: 100,
        marginLevel: 50,
        currency: "USD",
        leverage: 0,
        credit: 0,
        profit: 0,
      },
      positions: [
        {
          ticket: 111,
          symbol: "EURUSD",
          type: "BUY",
          volume: 0,
          openPrice: 1.0,
          currentPrice: 1.1,
          stopLoss: 0.9,
          takeProfit: 1.2,
          currentProfit: 0,
          swap: 0,
          magic: 0,
          openTime: "not-a-timestamp",
        },
      ],
    };

    expect(() => validateBridgeHeartbeat(invalid)).toThrow();
  });
});
