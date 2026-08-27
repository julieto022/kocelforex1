import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { conflict, notFound, toApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/server/audit.server";
import { requireOwnership } from "@/lib/server/ownership.server";

const idSchema = z.object({ connectionId: z.string().uuid() });

const requestSchema = z.object({ requestId: z.string().uuid() });
const approveSchema = requestSchema.extend({
  brokerId: z.string().uuid(),
  accountName: z.string().trim().min(2).max(80),
  accountType: z.string().trim().max(40).nullish(),
  environment: z.enum(["DEMO", "REAL"]),
  nickname: z.string().trim().max(60).nullish(),
});

export const getAuthorizationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: request, error } = await supabaseAdmin
      .from("mt5_authorization_requests")
      .select(
        "id, mt5_login, server, environment, account_name, broker_hint, ea_version, terminal_build, status, expires_at",
      )
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw toApiError(error);
    if (!request) throw notFound();
    if (
      new Date(request.expires_at).getTime() < Date.now() &&
      ["WAITING_FOR_USER", "AUTHORIZATION_REQUESTED"].includes(request.status)
    ) {
      await supabaseAdmin
        .from("mt5_authorization_requests")
        .update({ status: "EXPIRED" })
        .eq("id", request.id);
      return { ...request, status: "EXPIRED" };
    }
    return request;
  });

export const approveAuthorizationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => approveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: request } = await supabaseAdmin
      .from("mt5_authorization_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!request) throw notFound();
    if (
      request.status !== "WAITING_FOR_USER" ||
      new Date(request.expires_at).getTime() < Date.now()
    ) {
      throw conflict("This authorization request is no longer available.");
    }
    const { data: connectionId, error } = await supabaseAdmin.rpc(
      "approve_mt5_authorization_request",
      {
        _request_id: data.requestId,
        _user_id: userId,
        _broker_id: data.brokerId,
        _account_name: data.accountName,
        // The SQL function accepts NULL for both; generated RPC types widen them to string.
        _nickname: (data.nickname ?? null) as unknown as string,
        _account_type: (data.accountType ?? null) as unknown as string,
        _environment: data.environment,
      },
    );
    if (error || !connectionId) {
      const message = error?.message ?? "";
      if (message.includes("DUPLICATE_CONNECTION"))
        throw conflict("That MT5 account is already connected to your workspace.");
      if (message.includes("AUTHORIZATION_EXPIRED"))
        throw conflict("This authorization request has expired.");
      if (message.includes("AUTHORIZATION_ALREADY_DECIDED"))
        throw conflict("This authorization request has already been decided.");
      if (message.includes("ENVIRONMENT_MISMATCH"))
        throw conflict("The selected environment does not match the MT5 terminal.");
      if (message.includes("BROKER_NOT_SUPPORTED"))
        throw conflict("That broker is not available for MT5 connections.");
      if (message.includes("SERVER_MISMATCH"))
        throw conflict("The broker server does not match the MT5 terminal.");
      throw toApiError(error);
    }
    await recordAudit({
      userId,
      action: "CONNECTION_AUTHORIZED",
      entityType: "broker_connection",
      entityId: connectionId,
    });
    return { connectionId };
  });

export const rejectAuthorizationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("mt5_authorization_requests")
      .update({
        status: "REJECTED",
        user_id: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.requestId)
      .eq("status", "WAITING_FOR_USER");
    if (error) throw toApiError(error);
    await recordAudit({
      userId: context.userId,
      action: "CONNECTION_REJECTED",
      entityType: "mt5_authorization_request",
      entityId: data.requestId,
    });
    return { ok: true as const };
  });

const renameSchema = idSchema.extend({ nickname: z.string().trim().min(1).max(60) });

export const renameConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => renameSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOwnership(supabase, "broker_connections", data.connectionId, userId);
    const { error } = await supabase
      .from("broker_connections")
      .update({ nickname: data.nickname })
      .eq("id", data.connectionId);
    if (error) throw toApiError(error);
    return { ok: true as const };
  });

/**
 * Removes the account from the Kocel workspace. It never touches MT5 trades —
 * the Bridge EA simply stops being authorised for this connection.
 */
export const disconnectConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOwnership(supabase, "broker_connections", data.connectionId, userId);

    const { error: revokeError } = await supabase
      .from("broker_connections")
      .update({ status: "REVOKED", revoked_at: new Date().toISOString() })
      .eq("id", data.connectionId);
    if (revokeError) throw toApiError(revokeError);

    const { error } = await supabase
      .from("broker_connections")
      .delete()
      .eq("id", data.connectionId);
    if (error) throw toApiError(error);

    await recordAudit({
      userId,
      action: "CONNECTION_REMOVED",
      entityType: "broker_connection",
      entityId: data.connectionId,
    });
    return { ok: true as const };
  });

export const revokeConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOwnership(supabase, "broker_connections", data.connectionId, userId);
    const { error } = await supabase
      .from("broker_connections")
      .update({
        status: "REVOKED",
        revoked_at: new Date().toISOString(),
      })
      .eq("id", data.connectionId);
    if (error) throw toApiError(error);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("bridge_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("connection_id", data.connectionId)
      .is("revoked_at", null);
    await recordAudit({
      userId,
      action: "CONNECTION_REVOKED",
      entityType: "broker_connection",
      entityId: data.connectionId,
    });
    return { ok: true as const };
  });

/** Current Bridge state for a single connection. */
export const getConnectionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("broker_connections")
      .select("id, status, last_seen_at, ea_version, terminal_build, authorized_at, revoked_at")
      .eq("id", data.connectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw toApiError(error);
    if (!row) throw notFound();
    return row;
  });
