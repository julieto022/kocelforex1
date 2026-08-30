import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { fail, ok } from "@/lib/api/response";
import { isApiError, unauthorized } from "@/lib/api/errors";
import { executeTradeCommand, tradeExecutionRequestSchema } from "@/lib/server/trade.server";
import { logger } from "@/lib/api/logger";

async function getAuthenticatedUser(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = authHeader.slice(7).trim();
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(token);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/** User submits a trade command (OPEN_MARKET, CLOSE_POSITION, MODIFY_POSITION, CANCEL_PENDING_ORDER) */
export const Route = createFileRoute("/api/protected/mt5/orders/execute")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204 }),
      POST: async ({ request }) => {
        try {
          // Require authenticated user
          const userId = await getAuthenticatedUser(request);
          if (!userId) {
            return fail("UNAUTHENTICATED", "Authentication required.");
          }

          // Parse and validate request
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return fail("INVALID_REQUEST", "Request body must be valid JSON.");
          }

          const validated = tradeExecutionRequestSchema.safeParse(body);
          if (!validated.success) {
            return fail("VALIDATION_ERROR", "Request validation failed.");
          }

          // Execute the trade command
          const result = await executeTradeCommand(userId, validated.data);

          // Log the execution
          logger.info("api", "trade command executed", {
            userId,
            operation: validated.data.operation,
            status: result.status,
          });

          return ok(result, "Trade command submitted.");
        } catch (error) {
          if (isApiError(error)) {
            return fail(error.code, error.message);
          }
          logger.error("api", "Unexpected error in trade execution", { error });
          return fail("INTERNAL_ERROR", "An unexpected error occurred.");
        }
      },
    },
  },
});
