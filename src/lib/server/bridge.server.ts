/**
 * Bridge service implementation. Server-only: it runs with the admin client
 * because the caller is an EA in the user's terminal, not a signed-in browser.
 */

import { z } from "zod";

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

/**
 * MT5 terminals report times as "YYYY.MM.DD HH:MM:SS". Accept that alongside
 * ISO-8601 and normalise to an ISO UTC instant the database can store.
 */
export const bridgeTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((value, ctx) => {
    const mt5 = value.match(
      /^(\d{4})[.\-/](\d{2})[.\-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?Z?$/,
    );
    const iso = mt5
      ? `${mt5[1]}-${mt5[2]}-${mt5[3]}T${mt5[4]}:${mt5[5]}:${mt5[6] ?? "00"}Z`
      : value;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid timestamp." });
      return z.NEVER;
    }
    return parsed.toISOString();
  });

const bridgePositionSchema = z.object({
  ticket: z.number().int().positive(),
  symbol: z.string().trim().min(1).max(32),
  type: z.string().trim().min(1).max(32),
  volume: z.number().positive(),
  openPrice: z.number().positive(),
  currentPrice: z.number().positive(),
  stopLoss: z.number().nullable().optional(),
  takeProfit: z.number().nullable().optional(),
  currentProfit: z.number(),
  swap: z.number(),
  magic: z.number().int().nullable().optional(),
  openTime: bridgeTimestampSchema,
});

const bridgeOrderSchema = z.object({
  ticket: z.number().int().positive(),
  symbol: z.string().trim().min(1).max(32),
  type: z.string().trim().min(1).max(32),
  volume: z.number().positive(),
  price: z.number().positive(),
  stopLoss: z.number().nullable().optional(),
  takeProfit: z.number().nullable().optional(),
  currentState: z.string().trim().min(1).max(32),
  magic: z.number().int().nullable().optional(),
  createdAt: bridgeTimestampSchema,
});

const bridgeAccountSchema = z.object({
  balance: z.number().finite(),
  equity: z.number().finite(),
  margin: z.number().finite(),
  freeMargin: z.number().finite(),
  marginLevel: z.number().finite().nullable(),
  credit: z.number().nonnegative().finite().optional(),
  profit: z.number().finite().optional(),
  currency: z.string().trim().min(3).max(8),
  leverage: z.number().int().positive().nullable(),
});

export const bridgeHeartbeatSchema = z.object({
  status: z.enum(["CONNECTED", "ERROR"]),
  account: bridgeAccountSchema.optional(),
  positions: z.array(bridgePositionSchema).max(500).optional(),
  orders: z.array(bridgeOrderSchema).max(500).optional(),
  openTrades: z.number().int().min(0).max(10_000).optional(),
  message: z.string().trim().max(300).nullish(),
});

export function validateBridgeHeartbeat(payload: unknown): BridgeHeartbeat {
  const parsed = bridgeHeartbeatSchema.parse(payload);
  if (
    parsed.account &&
    parsed.account.marginLevel !== null &&
    !Number.isFinite(parsed.account.marginLevel)
  ) {
    throw new Error("Invalid account margin level value.");
  }
  return parsed as BridgeHeartbeat;
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
        throw new ApiError(
          "AUTHORIZATION_ALREADY_DECIDED",
          "That authorization request has already issued a Bridge session.",
        );
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
    const normalized = validateBridgeHeartbeat(payload);
    const db = await admin();
    const now = new Date().toISOString();

    const { data: before } = await db
      .from("broker_connections")
      .select("status, mt5_login, last_seen_at")
      .eq("id", identity.connectionId)
      .maybeSingle();

    if (!before) throw notFound("That connection no longer exists.");

    const status = normalized.status === "ERROR" ? "ERROR" : "CONNECTED";
    const account = normalized.account ?? null;

    // Build account update object, converting undefined to null for optional fields
    const accountUpdate = account
      ? {
          balance: account.balance,
          equity: account.equity,
          credit: account.credit ?? null,
          margin: account.margin,
          free_margin: account.freeMargin,
          margin_level: account.marginLevel,
          profit: account.profit ?? null,
          currency: account.currency,
          leverage: account.leverage,
        }
      : {};

    const { data: connection } = await db
      .from("broker_connections")
      .update({
        status,
        last_seen_at: now,
        last_sync_at: now,
        ...accountUpdate,
        ...(status === "CONNECTED" ? { last_connected_at: now } : {}),
      })
      .eq("id", identity.connectionId)
      .select("id, status, last_seen_at, last_sync_at, mt5_login")
      .maybeSingle();

    if (!connection) throw notFound("That connection no longer exists.");

    if (account) {
      await db.from("mt5_account_snapshots").insert({
        user_id: identity.userId,
        broker_connection_id: identity.connectionId,
        mt5_login: before.mt5_login,
        status,
        balance: account.balance,
        equity: account.equity,
        credit: account.credit ?? null,
        margin: account.margin,
        free_margin: account.freeMargin,
        margin_level: account.marginLevel,
        profit: account.profit ?? null,
        currency: account.currency,
        leverage: account.leverage,
        snapshot_at: now,
      });
    }

    if (normalized.positions?.length) {
      await db
        .from("mt5_open_positions")
        .delete()
        .eq("broker_connection_id", identity.connectionId)
        .eq("user_id", identity.userId);
      await db.from("mt5_open_positions").insert(
        normalized.positions.map((position) => ({
          user_id: identity.userId,
          broker_connection_id: identity.connectionId,
          mt5_login: before.mt5_login,
          ticket: position.ticket,
          symbol: position.symbol,
          direction: position.type,
          volume: position.volume,
          open_price: position.openPrice,
          current_price: position.currentPrice,
          stop_loss: position.stopLoss ?? null,
          take_profit: position.takeProfit ?? null,
          current_profit: position.currentProfit,
          swap: position.swap,
          magic_number: position.magic ?? null,
          opened_at: position.openTime,
          created_at: now,
        })),
      );
    }

    if (normalized.orders?.length) {
      await db
        .from("mt5_pending_orders")
        .delete()
        .eq("broker_connection_id", identity.connectionId)
        .eq("user_id", identity.userId);
      await db.from("mt5_pending_orders").insert(
        normalized.orders.map((order) => ({
          user_id: identity.userId,
          broker_connection_id: identity.connectionId,
          mt5_login: before.mt5_login,
          ticket: order.ticket,
          symbol: order.symbol,
          order_type: order.type,
          volume: order.volume,
          price: order.price,
          stop_loss: order.stopLoss ?? null,
          take_profit: order.takeProfit ?? null,
          state: order.currentState,
          magic_number: order.magic ?? null,
          created_at: order.createdAt,
        })),
      );
    }

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

    const online = isOnline(connection.last_seen_at);
    return {
      connectionId: identity.connectionId,
      status: online ? "CONNECTED" : "STALE",
      lastSeenAt: connection.last_seen_at,
      online,
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
    const online = isOnline(data.last_seen_at);
    return {
      connectionId: data.id,
      status: online ? (data.status === "ERROR" ? "ERROR" : "CONNECTED") : "STALE",
      lastSeenAt: data.last_seen_at,
      online,
    };
  },
};

function canonicalAppUrl(): string {
  const preferredAppUrl = "https://kocelforexhub.lovable.app";
  const raw = (process.env["PUBLIC_APP_URL"] || preferredAppUrl).trim();

  try {
    const candidate = raw.includes("kocelforex1") ? preferredAppUrl : raw;
    const url = new URL(candidate);
    if (!url.protocol.startsWith("http")) throw new Error("invalid protocol");
    return url.origin;
  } catch {
    throw new ApiError("INTERNAL_ERROR", "PUBLIC_APP_URL is invalid.");
  }
}
