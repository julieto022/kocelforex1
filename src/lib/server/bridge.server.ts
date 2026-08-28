/**
 * Bridge service implementation. Server-only: it runs with the admin client
 * because the caller is an EA in the user's terminal, not a signed-in browser.
 */

import {
  AUTHORIZATION_REQUEST_TTL_MINUTES,
  BRIDGE_AUTHORIZATION_POLL_SECONDS,
  BRIDGE_SESSION_TTL_SECONDS,
  BRIDGE_HEARTBEAT_TIMEOUT_SECONDS,
  BRIDGE_TOKEN_TTL_SECONDS,
} from "@/lib/api/constants";
import { ApiError, notFound } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import type {
  BridgeHeartbeat,
  BridgeIdentity,
  BridgeRegisterRequest,
  BridgeRegisterResult,
  BridgeService,
  BridgeStatus,
} from "@/lib/contracts/broker";
import { recordAudit } from "@/lib/server/audit.server";
import {
  hashSecretValue,
  randomToken,
  signBridgeToken,
  verifyBridgeToken,
} from "@/lib/server/crypto.server";
import { pushNotification } from "@/lib/server/notify.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < BRIDGE_HEARTBEAT_TIMEOUT_SECONDS * 1000;
}

export const bridgeService: BridgeService = {
  async register(request: BridgeRegisterRequest): Promise<BridgeRegisterResult> {
    const db = await admin();
    const pollToken = randomToken(32);
    const expiresAt = new Date(
      Date.now() + AUTHORIZATION_REQUEST_TTL_MINUTES * 60_000,
    ).toISOString();

    const { data: authorization, error } = await db
      .from("mt5_authorization_requests")
      .insert({
        mt5_login: request.mt5Login,
        server: request.server,
        environment: request.environment ?? null,
        broker_hint: request.broker ?? null,
        account_name: request.accountName ?? null,
        currency: request.currency ?? null,
        leverage: request.leverage ?? null,
        ea_version: request.eaVersion,
        terminal_build: request.terminalBuild ?? null,
        terminal_name: request.terminalName ?? null,
        terminal_company: request.terminalCompany ?? null,
        poll_token_hash: await hashSecretValue(pollToken),
        expires_at: expiresAt,
        status: "WAITING_FOR_USER",
      })
      .select("id")
      .single();
    if (error || !authorization)
      throw new ApiError("INTERNAL_ERROR", "Could not create authorization request.");

    await recordAudit({
      userId: null,
      action: "CONNECTION_AUTHORIZATION_REQUESTED",
      entityType: "mt5_authorization_request",
      entityId: authorization.id,
    });
    logger.info("bridge", "authorization requested", { requestId: authorization.id });

    return {
      authorizationUrl: `${canonicalAppUrl()}/authorize/mt5/${authorization.id}`,
      requestId: authorization.id,
      pollToken,
      expiresAt,
      pollSeconds: BRIDGE_AUTHORIZATION_POLL_SECONDS,
      heartbeatSeconds: 30,
    };
  },

  async pollAuthorization(pollToken: string) {
    const db = await admin();
    const { data } = await db
      .from("mt5_authorization_requests")
      .select("id, status, connection_id, expires_at, poll_token_used_at")
      .eq("poll_token_hash", await hashSecretValue(pollToken))
      .maybeSingle();
    if (!data) throw notFound("That authorization request is not valid.");
    if (data.status === "AUTHORIZED" && data.poll_token_used_at)
      throw new ApiError(
        "AUTHORIZATION_ALREADY_DECIDED",
        "That authorization request has already issued a Bridge session.",
      );
    if (
      new Date(data.expires_at).getTime() < Date.now() &&
      ["WAITING_FOR_USER", "AUTHORIZATION_REQUESTED"].includes(data.status)
    ) {
      await db
        .from("mt5_authorization_requests")
        .update({ status: "EXPIRED" })
        .eq("id", data.id)
        .eq("status", "WAITING_FOR_USER");
      return { status: "EXPIRED" as const };
    }
    if (data.status !== "AUTHORIZED" || !data.connection_id) {
      return { status: data.status as "WAITING_FOR_USER" | "REJECTED" | "EXPIRED" | "REVOKED" };
    }
    const { data: connection } = await db
      .from("broker_connections")
      .select("id, user_id, mt5_login, status, revoked_at")
      .eq("id", data.connection_id)
      .maybeSingle();
    if (!connection || connection.revoked_at || connection.status === "REVOKED")
      return { status: "REVOKED" as const };
    const sessionId = crypto.randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAtSeconds = issuedAt + BRIDGE_SESSION_TTL_SECONDS;
    const token = await signBridgeToken({
      cid: connection.id,
      uid: connection.user_id,
      login: connection.mt5_login,
      sid: sessionId,
      iat: issuedAt,
      jti: randomToken(16),
      exp: expiresAtSeconds,
    });
    const { error: sessionError } = await db.rpc("issue_bridge_session", {
      _request_id: data.id,
      _poll_token_hash: await hashSecretValue(pollToken),
      _session_id: sessionId,
      _token_hash: await hashSecretValue(token),
      _user_id: connection.user_id,
      _connection_id: connection.id,
      _expires_at: new Date(expiresAtSeconds * 1000).toISOString(),
    });
    if (sessionError) {
      if (sessionError.message.includes("AUTHORIZATION_ALREADY_DECIDED")) {
        throw new ApiError("AUTHORIZATION_ALREADY_DECIDED", "That authorization request has already issued a Bridge session.");
      }
      throw new ApiError("INTERNAL_ERROR", "Could not create the Bridge session.");
    }
    return {
      status: "AUTHORIZED" as const,
      token,
      tokenExpiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
      connectionId: connection.id,
    };
  },

  async authenticate(token: string): Promise<BridgeIdentity | null> {
    const claims = await verifyBridgeToken(token);
    if (!claims) return null;

    const db = await admin();
    const { data } = await db
      .from("broker_connections")
      .select("id, user_id, mt5_login, status, revoked_at")
      .eq("id", claims.cid)
      .maybeSingle();
    if (
      !data ||
      data.user_id !== claims.uid ||
      data.mt5_login !== claims.login ||
      data.revoked_at ||
      data.status === "REVOKED"
    )
      return null;
    const { data: session } = await db
      .from("bridge_sessions")
      .select("id, expires_at, revoked_at")
      .eq("id", claims.sid)
      .eq("connection_id", data.id)
      .eq("user_id", data.user_id)
      .eq("token_hash", await hashSecretValue(token))
      .maybeSingle();
    if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now())
      return null;
    await db
      .from("bridge_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", session.id);

    return { connectionId: data.id, userId: data.user_id, mt5Login: data.mt5_login };
  },

  async heartbeat(identity: BridgeIdentity, payload: BridgeHeartbeat): Promise<BridgeStatus> {
    const db = await admin();
    const now = new Date().toISOString();

    const { data: before } = await db
      .from("broker_connections")
      .select("status")
      .eq("id", identity.connectionId)
      .maybeSingle();

    const status = payload.status === "ERROR" ? "ERROR" : "CONNECTED";
    await db
      .from("broker_connections")
      .update({
        status,
        last_seen_at: now,
        ...(payload.account
          ? {
              balance: payload.account.balance,
              equity: payload.account.equity,
              margin: payload.account.margin,
              free_margin: payload.account.freeMargin,
              margin_level: payload.account.marginLevel,
              currency: payload.account.currency,
              leverage: payload.account.leverage,
            }
          : {}),
        ...(status === "CONNECTED" ? { last_connected_at: now } : {}),
      })
      .eq("id", identity.connectionId);

    if (before?.status !== "CONNECTED" && status === "CONNECTED") {
      await recordAudit({
        userId: identity.userId,
        action: "CONNECTION_AUTHENTICATED",
        entityType: "broker_connection",
        entityId: identity.connectionId,
      });
      await pushNotification({
        userId: identity.userId,
        type: "ACCOUNT_CONNECTED",
        title: "MT5 account connected",
        message: "The Kocel Bridge EA is reporting this account.",
        entityType: "broker_connection",
        entityId: identity.connectionId,
      });
    }

    return {
      connectionId: identity.connectionId,
      status,
      lastSeenAt: now,
      online: status === "CONNECTED",
    };
  },

  async disconnect(identity: BridgeIdentity, reason?: string): Promise<void> {
    const db = await admin();
    await db
      .from("broker_connections")
      .update({ status: "DISCONNECTED", revoked_at: new Date().toISOString() })
      .eq("id", identity.connectionId);
    await db
      .from("bridge_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("connection_id", identity.connectionId)
      .is("revoked_at", null);

    await recordAudit({
      userId: identity.userId,
      action: "CONNECTION_DISCONNECTED",
      entityType: "broker_connection",
      entityId: identity.connectionId,
      metadata: reason ? { reason } : undefined,
    });
    await pushNotification({
      userId: identity.userId,
      type: "ACCOUNT_DISCONNECTED",
      title: "MT5 account disconnected",
      message: "The Kocel Bridge EA stopped reporting this account.",
      entityType: "broker_connection",
      entityId: identity.connectionId,
    });
  },

  async status(identity: BridgeIdentity): Promise<BridgeStatus> {
    const db = await admin();
    const { data } = await db
      .from("broker_connections")
      .select("id, status, last_seen_at")
      .eq("id", identity.connectionId)
      .maybeSingle();
    if (!data) throw notFound("That connection no longer exists.");
    return {
      connectionId: data.id,
      status: data.status as BridgeStatus["status"],
      lastSeenAt: data.last_seen_at,
      online: isOnline(data.last_seen_at),
    };
  },
};

function canonicalAppUrl(): string {
  const raw = process.env["PUBLIC_APP_URL"];
  if (!raw) throw new ApiError("INTERNAL_ERROR", "PUBLIC_APP_URL is not configured.");
  try {
    const url = new URL(raw);
    if (!url.protocol.startsWith("http")) throw new Error("invalid protocol");
    return url.origin;
  } catch {
    throw new ApiError("INTERNAL_ERROR", "PUBLIC_APP_URL is invalid.");
  }
}
