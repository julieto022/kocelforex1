import { createFileRoute } from "@tanstack/react-router";

import { fail, ok } from "@/lib/api/response";
import { isApiError } from "@/lib/api/errors";
import {
  authenticateBridge,
  limitBridge,
  preflight,
  toErrorResponse,
} from "@/lib/server/bridge-http.server";
import { getPendingCommandsForBridge } from "@/lib/server/trade.server";
import { logger } from "@/lib/api/logger";

/** EA polls for pending trade commands to execute */
export const Route = createFileRoute("/api/public/bridge/commands/poll")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          // Authenticate the Bridge EA
          const identity = await authenticateBridge(request);
          if (!identity) return fail("UNAUTHENTICATED", "Invalid or expired bridge token.");

          // Apply rate limiting
          await limitBridge(identity);

          // Get pending commands for this connection
          const pollResponse = await getPendingCommandsForBridge(identity.connectionId);

          logger.info("api", "commands polled", {
            connectionId: identity.connectionId,
            commandCount: pollResponse.commands.length,
          });

          return ok(pollResponse, "Commands retrieved.");
        } catch (error) {
          return toErrorResponse(error);
        }
      },
    },
  },
});
