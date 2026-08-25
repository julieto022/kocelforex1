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

const schema = z.object({ reason: z.string().trim().max(200).nullish() }).default({});

/** Step 4: the EA reports a clean shutdown. MT5 trades are never touched. */
export const Route = createFileRoute("/api/public/bridge/disconnect")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const identity = await authenticateBridge(request);
          if (!identity) return fail("UNAUTHENTICATED", "Invalid or expired bridge token.");
          await limitBridge(identity);
          const body = await readJson(request, schema).catch(() => ({ reason: null }));
          await bridgeService.disconnect(identity, body.reason ?? undefined);
          return ok({ connectionId: identity.connectionId }, "Disconnected");
        } catch (error) {
          return toErrorResponse(error);
        }
      },
    },
  },
});
