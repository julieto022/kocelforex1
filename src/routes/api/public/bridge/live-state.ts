import { createFileRoute } from "@tanstack/react-router";

import { fail, ok } from "@/lib/api/response";
import { bridgeLiveSyncSchema, syncLiveState } from "@/lib/server/live-sync.server";
import {
  authenticateBridge,
  preflight,
  readJson,
  toErrorResponse,
} from "@/lib/server/bridge-http.server";
import { enforceRateLimit } from "@/lib/server/rate-limit.server";

/**
 * Phase 3.4 fast trading-state sync. The Bridge EA posts here about once per
 * second, but only when the MT5 trading state actually changed.
 */
export const Route = createFileRoute("/api/public/bridge/live-state")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const identity = await authenticateBridge(request);
          if (!identity) return fail("UNAUTHENTICATED", "Invalid or expired bridge token.");
          await enforceRateLimit("bridgeLiveSync", identity.connectionId);
          const body = await readJson(request, bridgeLiveSyncSchema);
          const result = await syncLiveState(identity, body);
          return ok(result, "Live state synchronised");
        } catch (error) {
          return toErrorResponse(error);
        }
      },
    },
  },
});
