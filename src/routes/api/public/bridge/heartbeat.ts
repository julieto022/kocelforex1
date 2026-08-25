import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { bridgeService } from "@/lib/server/bridge.server";
import {
  authenticateBridge,
  limitBridge,
  preflight,
  readJson,
  toErrorResponse,
} from "@/lib/server/bridge-http.server";

const schema = z.object({
  status: z.enum(["CONNECTED", "ERROR"]),
  account: z
    .object({
      balance: z.number(),
      equity: z.number(),
      margin: z.number(),
      freeMargin: z.number(),
      marginLevel: z.number().nullable(),
      currency: z.string().trim().max(8),
      leverage: z.number().nullable(),
    })
    .optional(),
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
          const status = await bridgeService.heartbeat(identity, body);
          return ok(status, "Heartbeat received");
        } catch (error) {
          return toErrorResponse(error);
        }
      },
    },
  },
});
