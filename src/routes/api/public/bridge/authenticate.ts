import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { bridgeService } from "@/lib/server/bridge.server";
import {
  authenticateBridge,
  limitBridge,
  preflight,
  toErrorResponse,
} from "@/lib/server/bridge-http.server";
import { enforceRateLimit } from "@/lib/server/rate-limit.server";

const schema = z.object({ pollToken: z.string().min(20).max(200) });

/** Step 2: the EA confirms its session token is still accepted. */
export const Route = createFileRoute("/api/public/bridge/authenticate")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const header = request.headers.get("authorization");
          if (!header) {
            const body = await request.json().catch(() => null);
            const parsed = schema.safeParse(body);
            if (!parsed.success) return fail("UNAUTHENTICATED", "Authorization is still pending.");
            await enforceRateLimit("bridgePoll", parsed.data.pollToken);
            return ok(
              await bridgeService.pollAuthorization(parsed.data.pollToken),
              "Authorization status",
            );
          }
          const identity = await authenticateBridge(request);
          if (!identity) return fail("UNAUTHENTICATED", "Invalid or expired bridge token.");
          await limitBridge(identity);
          return ok(
            { connectionId: identity.connectionId, mt5Login: identity.mt5Login },
            "Authenticated",
          );
        } catch (error) {
          return toErrorResponse(error);
        }
      },
    },
  },
});
