import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { isApiError } from "@/lib/api/errors";
import {
  authenticateBridge,
  limitBridge,
  preflight,
  readJson,
  toErrorResponse,
} from "@/lib/server/bridge-http.server";
import { bridgeCommandResultSchema, recordTradeExecutionResult } from "@/lib/server/trade.server";
import { logger } from "@/lib/api/logger";

/** EA reports the result of a trade command execution */
export const Route = createFileRoute("/api/public/bridge/commands/$commandId/result")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request, params }) => {
        try {
          // Authenticate the Bridge EA
          const identity = await authenticateBridge(request);
          if (!identity) return fail("UNAUTHENTICATED", "Invalid or expired bridge token.");

          // Apply rate limiting
          await limitBridge(identity);

          // Validate commandId is a UUID
          if (
            !params.commandId ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              params.commandId,
            )
          ) {
            return fail("VALIDATION_ERROR", "Invalid command ID.");
          }

          // Parse and validate result
          const body = await readJson(request, bridgeCommandResultSchema);

          // The body must describe the command named in the URL
          if (body.commandId !== params.commandId) {
            return fail("VALIDATION_ERROR", "Command ID mismatch.");
          }

          // Record the execution result (idempotent: completed commands are not overwritten)
          await recordTradeExecutionResult(identity.connectionId, body);

          logger.info("api", "trade result recorded", {
            commandId: params.commandId,
            status: body.status,
            connectionId: identity.connectionId,
          });

          return ok({ success: true }, "Trade result recorded.");
        } catch (error) {
          return toErrorResponse(error);
        }
      },
    },
  },
});
