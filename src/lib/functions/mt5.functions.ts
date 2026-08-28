import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { conflict, notFound, toApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/server/audit.server";
import { requireOwnership } from "@/lib/server/ownership.server";

const idSchema = z.object({ connectionId: z.string().uuid() });

const requestSchema = z.object({ requestId: z.string().uuid() });

type AuthorizationBroker = {
  id: string;
  name: string;
  slug: string;
  status: string;
  supported: boolean;
  connection_config: unknown;
};

type AuthorizationValidation =
  | { ok: true; brokerId: string }
  | { ok: false; code: "UNSUPPORTED_BROKER" | "INVALID_ENVIRONMENT" | "INVALID_BROKER_SERVER"; message: string };

function normalized(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function matchesServerPattern(server: string, pattern: string) {
  const escaped = pattern.replace(/[.+^${}()|[\\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replaceAll("%", ".*").replaceAll("_", ".")}$`, "i").test(server);
}

function validateAuthorizationBroker(
  request: { broker_hint: string | null; server: string; environment: string | null },
  brokers: AuthorizationBroker[],
): AuthorizationValidation {
  if (request.environment !== "DEMO" && request.environment !== "REAL") {
    return {
      ok: false,
      code: "INVALID_ENVIRONMENT",
      message: "The MT5 terminal environment is missing or invalid.",
    };
  }

  const brokerHint = normalized(request.broker_hint);
  const broker = brokers.find((candidate) => {
    const config = candidate.connection_config;
    const hints =
      config && typeof config === "object" && "broker_hints" in config && Array.isArray(config.broker_hints)
        ? config.broker_hints.filter((hint): hint is string => typeof hint === "string")
        : [];
    return (
      normalized(candidate.slug) === brokerHint ||
      normalized(candidate.name) === brokerHint ||
      hints.some((hint) => normalized(hint) === brokerHint)
    );
  });

  if (!broker || !broker.supported || !["supported", "active"].includes(broker.status)) {
    return {
      ok: false,
      code: "UNSUPPORTED_BROKER",
      message: "Unsupported Broker. Kocel Bridge currently supports Exness and Deriv.",
    };
  }

  const config = broker.connection_config;
  const patterns =
    config && typeof config === "object" && "server_patterns" in config && Array.isArray(config.server_patterns)
      ? config.server_patterns.filter((pattern): pattern is string => typeof pattern === "string")
      : [];
  if (!patterns.some((pattern) => matchesServerPattern(request.server, pattern))) {
    return {
      ok: false,
      code: "INVALID_BROKER_SERVER",
      message: "The detected broker and MT5 server do not match a supported Kocel configuration.",
    };
  }

  return { ok: true, brokerId: broker.id };
}

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
    const { data: brokers, error: brokersError } = await supabaseAdmin
      .from("brokers")
      .select("id, name, slug, status, supported, connection_config");
    if (brokersError) throw toApiError(brokersError);
    return {
      ...request,
      validation: validateAuthorizationBroker(request, (brokers ?? []) as AuthorizationBroker[]),
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
    const { data: brokers, error: brokersError } = await supabaseAdmin
      .from("brokers")
      .select("id, name, slug, status, supported, connection_config");
    if (brokersError) throw toApiError(brokersError);
    const validation = validateAuthorizationBroker(request, (brokers ?? []) as AuthorizationBroker[]);
    if (!validation.ok) throw conflict(validation.message);
    const { data: connectionId, error } = await supabaseAdmin.rpc(
      "approve_mt5_authorization_request",
      {
        _request_id: data.requestId,
        _user_id: userId,
        _broker_id: validation.brokerId,
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
