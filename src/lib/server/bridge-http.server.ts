/** Shared HTTP plumbing for the /api/public/bridge/* contract routes. */

import { z } from "zod";

import { isApiError } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { fail } from "@/lib/api/response";
import type { BridgeIdentity } from "@/lib/contracts/broker";
import { bridgeService } from "@/lib/server/bridge.server";
import { enforceRateLimit } from "@/lib/server/rate-limit.server";

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
};

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new z.ZodError([]);
  }
  return schema.parse(body);
}

/** Resolves the Bridge EA behind the request, or null when unauthenticated. */
export async function authenticateBridge(request: Request): Promise<BridgeIdentity | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  return bridgeService.authenticate(token);
}

export async function limitBridge(identity: BridgeIdentity): Promise<void> {
  await enforceRateLimit("bridge", identity.connectionId);
}

/** Converts any thrown value into the uniform failure envelope. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) {
    return fail("VALIDATION_ERROR", error.issues[0]?.message ?? "Invalid request body.");
  }
  if (isApiError(error)) return fail(error.code, error.message);
  logger.error("bridge", "unhandled bridge error", { error: String(error) });
  return fail("INTERNAL_ERROR", "Something went wrong on our side.");
}
