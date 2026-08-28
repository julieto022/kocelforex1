import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { conflict, notFound, toApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/server/audit.server";
import { requireOwnership } from "@/lib/server/ownership.server";

const idSchema = z.object({ connectionId: z.string().uuid() });

const requestSchema = z.object({ requestId: z.string().uuid() });

function validateAuthorizationRequest(request: {
  broker_hint: string | null;
  server: string;
  environment: string | null;
}) {
  if (!request.broker_hint?.trim()) {
    return { ok: false as const, message: "The MT5 terminal did not provide a broker name." };
  }
  if (
    request.server.length < 2 ||
    request.server.length > 120 ||
    /[\u0000-\u001F\u007F]/.test(request.server)
  ) {
    return { ok: false as const, message: "The MT5 terminal server value is invalid." };
  }
  if (request.environment !== "DEMO" && request.environment !== "REAL") {
    return {
      ok: false as const,
      message: "The MT5 terminal environment is missing or invalid.",
    };
  }
  return { ok: true as const, message: "MT5 broker detected." };
}

export const getAuthorizationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: request, error } = await supabaseAdmin
      .from("mt5_authorization_requests")
      .select(
        "id, mt5_login, server, environment, account_name, broker_hint, currency, leverage, ea_version, terminal_build, terminal_name, terminal_company, status, expires_at",
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
        .eq("id", request.id)
        .eq("status", "WAITING_FOR_USER");
      return { ...request, status: "EXPIRED", validation: validateAuthorizationRequest(request) };
    }
    return {
      ...request,
      validation: validateAuthorizationRequest(request),
    };
  });

export const approveAuthorizationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => requestSchema.parse(data))
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
    const validation = validateAuthorizationRequest(request);
    if (!validation.ok) throw conflict(validation.message);
    const { data: connectionId, error } = await supabaseAdmin.rpc(
      "approve_mt5_authorization_request",
      {
        _request_id: data.requestId,
        _user_id: userId,
        _broker_id: null as unknown as string,
        // Identity fields are read from the locked EA request by the SQL function.
        _account_name: null as unknown as string,
        _nickname: null as unknown as string,
        _account_type: null as unknown as string,
        _environment: null as unknown as string,
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
      if (message.includes("INVALID_ENVIRONMENT") || message.includes("ENVIRONMENT_MISMATCH"))
        throw conflict("The MT5 terminal environment is missing or invalid.");
      if (message.includes("INVALID_BROKER_IDENTITY"))
        throw conflict("The detected MT5 broker identity is invalid.");
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
    const { data: rejected, error } = await supabaseAdmin
      .from("mt5_authorization_requests")
      .update({
        status: "REJECTED",
        user_id: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.requestId)
      .eq("status", "WAITING_FOR_USER")
      .select("id")
      .maybeSingle();
    if (error) throw toApiError(error);
    if (!rejected) throw conflict("This authorization request is no longer available.");
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
