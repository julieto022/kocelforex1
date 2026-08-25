import { createFileRoute } from "@tanstack/react-router";

import { fail, ok } from "@/lib/api/response";
import {
  authenticateBridge,
  limitBridge,
  preflight,
  toErrorResponse,
} from "@/lib/server/bridge-http.server";

/** Step 2: the EA confirms its session token is still accepted. */
export const Route = createFileRoute("/api/public/bridge/authenticate")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
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
