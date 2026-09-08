import { describe, expect, it } from "vitest";

import { bridgeLiveSyncSchema } from "./live-sync.server";

describe("bridge live-state contract", () => {
  it("accepts actual MT5 closed-trade identifiers and financial fields", () => {
    const payload = {
      account: {
        balance: 1000,
        equity: 1012,
        margin: 100,
        freeMargin: 912,
        marginLevel: 1012,
        profit: 12,
        credit: 0,
        currency: "USD",
        leverage: 100,
      },
      positions: [],
      orders: [],
      closedTrades: [
        {
          ticket: 123,
          positionTicket: 123,
          dealTicket: 456,
          orderTicket: 789,
          symbol: "EURUSD",
          type: "BUY",
          volume: 0.1,
          entryPrice: 1.1,
          exitPrice: 1.101,
          profit: 10,
          commission: -1,
          swap: -0.2,
          netProfit: 8.8,
          openedAt: "2026-09-08T10:00:00Z",
          closedAt: "2026-09-08T10:01:00Z",
        },
      ],
    };

    expect(bridgeLiveSyncSchema.parse(payload).closedTrades).toHaveLength(1);
  });

  it("accepts an empty position set as authoritative", () => {
    expect(bridgeLiveSyncSchema.parse({ positions: [], orders: [] })).toMatchObject({
      positions: [],
      orders: [],
    });
  });
});