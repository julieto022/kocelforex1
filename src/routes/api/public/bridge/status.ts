import { createFileRoute } from "@tanstack/react-router";

import { fail, ok } from "@/lib/api/response";
import { bridgeService } from "@/lib/server/bridge.server";
import {
  authenticateBridge,
  limitBridge,
  preflight,
  toErrorResponse,
} from "@/lib/server/bridge-http.server";

/** Current server-side view of the connection, for EA self-diagnostics. */
export const Route = createFileRoute("/api/public/bridge/status")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request }) => {
        try {
          const identity = await authenticateBridge(request);
          if (!identity) return fail("UNAUTHENTICATED", "Invalid or expired bridge token.");
          await limitBridge(identity);
          return ok(await bridgeService.status(identity), "Status");
        } catch (error) {
          return toErrorResponse(error);
        }
      },
    },
  },
});
