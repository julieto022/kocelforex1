/**
 * Bridge service implementation. Server-only: it runs with the admin client
 * because the caller is an EA in the user's terminal, not a signed-in browser.
 */

import {
  BRIDGE_HEARTBEAT_TIMEOUT_SECONDS,
  BRIDGE_TOKEN_TTL_SECONDS,
} from "@/lib/api/constants";
import { ApiError, conflict, notFound } from "@/lib/api/errors";
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
import { hashSecretValue, signBridgeToken, verifyBridgeToken } from "@/lib/server/crypto.server";
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
    const codeHash = await hashSecretValue(request.code.trim().toUpperCase());

    const { data: connection, error } = await db
      .from("broker_connections")
      .select("id, user_id, mt5_login, code_state, connection_code_expires_at")
      .eq("connection_code_hash", codeHash)
      .maybeSingle();
    if (error) throw new ApiError("INTERNAL_ERROR", "Could not verify that code.");
    if (!connection) throw notFound("That connection code is not valid.");

    if (connection.code_state === "CLAIMED" || connection.code_state === "CONNECTED") {
      throw new ApiError("CODE_ALREADY_CLAIMED", "That code has already been used.");
    }
    if (
      connection.connection_code_expires_at &&
      new Date(connection.connection_code_expires_at).getTime() < Date.now()
    ) {
      await db.from("broker_connections").update({ code_state: "EXPIRED", status: "EXPIRED" }).eq("id", connection.id);
      throw new ApiError("CODE_EXPIRED", "That code has expired. Generate a new one in Kocel.");
    }
    if (connection.mt5_login !== request.mt5Login) {
      throw conflict("This code belongs to a different MT5 login.");
    }

    const expiresAtSeconds = Math.floor(Date.now() / 1000) + BRIDGE_TOKEN_TTL_SECONDS;
    const token = await signBridgeToken({
      cid: connection.id,
      uid: connection.user_id,
      login: connection.mt5_login,
      exp: expiresAtSeconds,
    });

    await db
      .from("broker_connections")
      .update({
        code_state: "CLAIMED",
        status: "AUTHENTICATING",
        claimed_at: new Date().toISOString(),
        connection_code: null,
        ea_version: request.eaVersion,
        server: request.server,
      })
      .eq("id", connection.id);

    await recordAudit({
      userId: connection.user_id,
      action: "CONNECTION_CLAIMED",
      entityType: "broker_connection",
      entityId: connection.id,
    });
    logger.info("bridge", "connection claimed", { connectionId: connection.id });

    return {
      token,
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
      heartbeatSeconds: 30,
    };
  },

  async authenticate(token: string): Promise<BridgeIdentity | null> {
    const claims = await verifyBridgeToken(token);
    if (!claims) return null;

    const db = await admin();
    const { data } = await db
      .from("broker_connections")
      .select("id, user_id, mt5_login")
      .eq("id", claims.cid)
      .maybeSingle();
    if (!data || data.user_id !== claims.uid || data.mt5_login !== claims.login) return null;

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
        code_state: status === "CONNECTED" ? "CONNECTED" : "FAILED",
        last_seen_at: now,
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
      .update({ status: "DISCONNECTED", code_state: "CANCELLED" })
      .eq("id", identity.connectionId);

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
