import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toApiError } from "@/lib/api/errors";
import { describeUserAgent, readRequestMetadata, recordAudit } from "@/lib/server/audit.server";
import { hashSecretValue } from "@/lib/server/crypto.server";

export type SessionSummary = {
  id: string;
  device: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  last_activity_at: string;
  created_at: string;
  current: boolean;
};

/** Stable identifier for the caller's Supabase session, never the token itself. */
function sessionIdentity(claims: Record<string, unknown>, userId: string): string {
  const sessionId = claims["session_id"];
  return typeof sessionId === "string" && sessionId ? sessionId : userId;
}

const SESSION_TTL_DAYS = 30;

/**
 * Upserts the caller's current device into the session register. Called once
 * after sign-in so the Security page can list and revoke devices.
 */
export const registerCurrentSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const { ip, userAgent } = readRequestMetadata();
    const { device, browser, os } = describeUserAgent(userAgent);
    const hash = await hashSecretValue(sessionIdentity(claims as never, userId));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("user_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("session_token_hash", hash)
      .maybeSingle();

    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();

    if (existing) {
      await supabaseAdmin
        .from("user_sessions")
        .update({
          last_activity_at: new Date().toISOString(),
          revoked_at: null,
          expires_at: expiresAt,
        })
        .eq("id", existing.id);
      return { id: existing.id };
    }

    const { data, error } = await supabaseAdmin
      .from("user_sessions")
      .insert({
        user_id: userId,
        session_token_hash: hash,
        device,
        browser,
        os,
        ip_address: ip,
        user_agent: userAgent,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (error) throw toApiError(error);

    await recordAudit({ userId, action: "AUTH_LOGIN", entityType: "session", entityId: data.id });
    return { id: data.id };
  });

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionSummary[]> => {
    const { supabase, userId, claims } = context;
    const currentHash = await hashSecretValue(sessionIdentity(claims as never, userId));

    const { data, error } = await supabase
      .from("user_sessions")
      .select(
        "id, device, browser, os, ip_address, last_activity_at, created_at, session_token_hash",
      )
      .eq("user_id", userId)
      .is("revoked_at", null)
      .order("last_activity_at", { ascending: false });
    if (error) throw toApiError(error);

    return (data ?? []).map((row) => ({
      id: row.id,
      device: row.device,
      browser: row.browser,
      os: row.os,
      ip_address: row.ip_address,
      last_activity_at: row.last_activity_at,
      created_at: row.created_at,
      current: row.session_token_hash === currentHash,
    }));
  });

export const revokeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ sessionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_sessions")
      .delete()
      .eq("id", data.sessionId)
      .eq("user_id", userId);
    if (error) throw toApiError(error);

    await recordAudit({
      userId,
      action: "SESSION_REVOKED",
      entityType: "session",
      entityId: data.sessionId,
    });
    return { ok: true as const };
  });

/** Signs every other device out. The caller's own session stays valid. */
export const revokeAllSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const currentHash = await hashSecretValue(sessionIdentity(claims as never, userId));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("revoked_at", null)
      .neq("session_token_hash", currentHash);
    if (error) throw toApiError(error);

    await recordAudit({ userId, action: "AUTH_LOGOUT_ALL", entityType: "session" });
    return { ok: true as const };
  });
