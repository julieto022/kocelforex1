import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

import type { AuditAction } from "@/lib/api/constants";
import { logger } from "@/lib/api/logger";

export type RequestMetadata = { ip: string | null; userAgent: string | null };

/** Best-effort request metadata; never throws, never records credentials. */
export function readRequestMetadata(): RequestMetadata {
  try {
    return {
      ip: getRequestIP({ xForwardedFor: true }) ?? null,
      userAgent: getRequestHeader("user-agent") ?? null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/**
 * Appends an audit entry. Auditing is observability, not business logic, so a
 * write failure is logged and swallowed rather than failing the user's action.
 */
export async function recordAudit(input: {
  userId: string | null;
  action: AuditAction;
  entityType?: string | null | undefined;
  entityId?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
}): Promise<void> {
  const { ip, userAgent } = readRequestMetadata();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      user_id: input.userId,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      ip_address: ip,
      user_agent: userAgent,
      metadata: (input.metadata ?? {}) as never,
    });
    if (error) throw error;
  } catch (error) {
    logger.warn("system", "audit write failed", { action: input.action, error: String(error) });
  }
}

/** Parses a user agent into coarse device/browser/os labels for session listing. */
export function describeUserAgent(userAgent: string | null): {
  device: string;
  browser: string;
  os: string;
} {
  const ua = (userAgent ?? "").toLowerCase();
  const device = /mobile|iphone|android/.test(ua)
    ? "Mobile"
    : /ipad|tablet/.test(ua)
      ? "Tablet"
      : "Desktop";
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome/")
      ? "Chrome"
      : ua.includes("safari/")
        ? "Safari"
        : ua.includes("firefox/")
          ? "Firefox"
          : "Unknown browser";
  const os = ua.includes("windows")
    ? "Windows"
    : ua.includes("mac os")
      ? "macOS"
      : ua.includes("android")
        ? "Android"
        : ua.includes("iphone") || ua.includes("ipad")
          ? "iOS"
          : ua.includes("linux")
            ? "Linux"
            : "Unknown OS";
  return { device, browser, os };
}
