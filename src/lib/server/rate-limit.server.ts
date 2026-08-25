import { rateLimited } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";

/**
 * Durable, per-window rate limiting. Counters live in the database because
 * server functions run on stateless workers — an in-memory map would not hold.
 */

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  /** Sign-in / registration attempts. */
  auth: { limit: 10, windowSeconds: 300 },
  /** Password reset requests. */
  passwordReset: { limit: 5, windowSeconds: 3600 },
  /** Connection-code generation, per user. */
  connectionCode: { limit: 10, windowSeconds: 3600 },
  /** Community posting. */
  communityPost: { limit: 10, windowSeconds: 3600 },
  /** Community comments. */
  communityComment: { limit: 40, windowSeconds: 3600 },
  /** Reports. */
  communityReport: { limit: 20, windowSeconds: 86400 },
  /** Bridge EA endpoints, per connection. */
  bridge: { limit: 240, windowSeconds: 60 },
  /** Bridge registration attempts, per caller. */
  bridgeRegister: { limit: 20, windowSeconds: 600 },
  /** Everything else. */
  general: { limit: 300, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

function windowStart(windowSeconds: number): string {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(Date.now() / ms) * ms).toISOString();
}

/**
 * Increments the counter for `identity` under `name`. Throws a RATE_LIMITED
 * ApiError once the window's allowance is exhausted.
 *
 * Fails open on infrastructure errors: a counter outage must not lock users out.
 */
export async function enforceRateLimit(name: RateLimitName, identity: string): Promise<void> {
  const rule = RATE_LIMITS[name];
  const bucketKey = `${name}:${identity}`;
  const start = windowStart(rule.windowSeconds);

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("bump_rate_limit", {
      _bucket_key: bucketKey,
      _window_start: start,
      _window_seconds: rule.windowSeconds,
    });
    if (error) throw error;
    const hits = typeof data === "number" ? data : 0;
    if (hits > rule.limit) throw rateLimited();
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") throw error;
    logger.warn("system", "rate limit counter unavailable", { name });
  }
}
