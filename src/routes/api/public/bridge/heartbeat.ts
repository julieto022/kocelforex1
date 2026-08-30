import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { bridgeService, bridgeTimestampSchema } from "@/lib/server/bridge.server";
import {
  authenticateBridge,
  limitBridge,
  preflight,
  readJson,
  toErrorResponse,
} from "@/lib/server/bridge-http.server";

const positionSchema = z
  .object({
    ticket: z.number().int().positive(),
    symbol: z.string().trim().min(1).max(32),
    type: z.string().trim().min(1).max(32),
    volume: z.number().positive(),
    openPrice: z.number().positive(),
    currentPrice: z.number().positive(),
    stopLoss: z.number().nullable().optional(),
    takeProfit: z.number().nullable().optional(),
    currentProfit: z.number(),
    swap: z.number(),
    magic: z.number().int().nullable().optional(),
    openTime: bridgeTimestampSchema,
  })
  .transform((p) => ({
    ...p,
    stopLoss: (p.stopLoss ?? null) as number | null,
    takeProfit: (p.takeProfit ?? null) as number | null,
    magic: (p.magic ?? null) as number | null,
  }));

const orderSchema = z
  .object({
    ticket: z.number().int().positive(),
    symbol: z.string().trim().min(1).max(32),
    type: z.string().trim().min(1).max(32),
    volume: z.number().positive(),
    price: z.number().positive(),
    stopLoss: z.number().nullable().optional(),
    takeProfit: z.number().nullable().optional(),
    currentState: z.string().trim().min(1).max(32),
    magic: z.number().int().nullable().optional(),
    createdAt: bridgeTimestampSchema,
  })
  .transform((o) => ({
    ...o,
    stopLoss: (o.stopLoss ?? null) as number | null,
    takeProfit: (o.takeProfit ?? null) as number | null,
    magic: (o.magic ?? null) as number | null,
  }));

const schema = z.object({
  status: z.enum(["CONNECTED", "ERROR"]),
  account: z
    .object({
      balance: z.number(),
      equity: z.number(),
      margin: z.number(),
      freeMargin: z.number(),
      marginLevel: z.number().nullable(),
      currency: z.string().trim().min(3).max(8),
      leverage: z.number().nullable(),
      credit: z.number().nonnegative().optional(),
      profit: z.number().optional(),
    })
    .optional(),
  positions: z.array(positionSchema).max(500).optional(),
  orders: z.array(orderSchema).max(500).optional(),
  openTrades: z.number().int().min(0).max(10_000).optional(),
  message: z.string().trim().max(300).nullish(),
});

/** Step 3: periodic liveness plus the current account snapshot. */
export const Route = createFileRoute("/api/public/bridge/heartbeat")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const identity = await authenticateBridge(request);
          if (!identity) return fail("UNAUTHENTICATED", "Invalid or expired bridge token.");
          await limitBridge(identity);
          const body = await readJson(request, schema);
          // Body has been validated and transformed by schema; cast is safe
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const status = await bridgeService.heartbeat(identity, body as any);
          return ok(status, "Heartbeat received");
        } catch (error) {
          return toErrorResponse(error);
        }
      },
    },
  },
});
