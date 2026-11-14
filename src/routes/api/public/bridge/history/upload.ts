import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import type { BridgeCandle } from "@/lib/contracts/broker";
import { bridgeCandleSchema } from "@/lib/server/bridge.server";
import {
  authenticateBridge,
  limitBridge,
  preflight,
  readJson,
  toErrorResponse,
} from "@/lib/server/bridge-http.server";
import { receiveMarketHistoryChunk } from "@/lib/server/market-history.server";

const schema = z.object({
  requestId: z.string().uuid(),
  candles: z.array(bridgeCandleSchema).max(4_000),
  complete: z.boolean(),
  errorMessage: z.string().trim().max(300).optional(),
});

export const Route = createFileRoute("/api/public/bridge/history/upload")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const identity = await authenticateBridge(request);
          if (!identity) return fail("UNAUTHENTICATED", "Invalid or expired bridge token.");
          await limitBridge(identity);
          const body = await readJson(request, schema);
          const candles: BridgeCandle[] = body.candles.map((candle) => ({
            ...candle,
            volume: candle.volume ?? null,
          }));
          const result = await receiveMarketHistoryChunk(identity, { ...body, candles });
          return ok(result, "Historical candles received.");
        } catch (error) {
          return toErrorResponse(error);
        }
      },
    },
  },
});
