import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { conflict, notFound, toApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/server/audit.server";
import { hashSecretValue, randomToken } from "@/lib/server/crypto.server";
import { enforceRateLimit } from "@/lib/server/rate-limit.server";
import { executeTradeCommand, tradeExecutionRequestSchema } from "@/lib/server/trade.server";

const createKeySchema = z.object({
  connectionId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  canTradeDirectly: z.boolean().default(false),
});

const keyIdSchema = z.object({ keyId: z.string().uuid() });

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean(),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getMcpApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data, error } = await db
      .from("mcp_api_keys")
      .select(
        "id, name, connection_id, token_hint, can_trade_directly, last_used_at, revoked_at, created_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw toApiError(error);
    return data ?? [];
  });

export const getMcpTradeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data, error } = await db
      .from("mcp_trade_requests")
      .select(
        "id, connection_id, payload, status, command_id, decision_reason, created_at, decided_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw toApiError(error);
    return (data ?? []).map((request) => ({
      ...request,
      payload: tradeExecutionRequestSchema.parse(request.payload),
    }));
  });

export const createMcpApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => createKeySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await enforceRateLimit("mcpKey", userId);

    const { data: connection, error: connectionError } = await supabase
      .from("broker_connections")
      .select("id")
      .eq("id", data.connectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (connectionError) throw toApiError(connectionError);
    if (!connection) throw notFound("The selected MT5 account was not found.");

    const db = await admin();
    const { count, error: countError } = await db
      .from("mcp_api_keys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("revoked_at", null);
    if (countError) throw toApiError(countError);
    if ((count ?? 0) >= 10) throw conflict("Revoke an existing MCP key before creating another.");

    const token = `kocel_mcp_${randomToken(32)}`;
    const { data: key, error } = await db
      .from("mcp_api_keys")
      .insert({
        user_id: userId,
        connection_id: data.connectionId,
        name: data.name,
        can_trade_directly: data.canTradeDirectly,
        token_hash: await hashSecretValue(token),
        token_hint: `${token.slice(0, 14)}…${token.slice(-4)}`,
      })
      .select(
        "id, name, connection_id, token_hint, can_trade_directly, last_used_at, revoked_at, created_at",
      )
      .single();
    if (error || !key) throw toApiError(error ?? new Error("The MCP key could not be created."));

    await recordAudit({
      userId,
      action: "MCP_API_KEY_CREATED",
      entityType: "mcp_api_key",
      entityId: key.id,
    });
    return { key, token };
  });

export const revokeMcpApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => keyIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: key, error } = await db
      .from("mcp_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.keyId)
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw toApiError(error);
    if (!key) throw notFound("That active MCP key was not found.");

    await recordAudit({
      userId: context.userId,
      action: "MCP_API_KEY_REVOKED",
      entityType: "mcp_api_key",
      entityId: data.keyId,
    });
    return { ok: true as const };
  });

export const reviewMcpTradeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => reviewSchema.parse(data))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: proposal, error: lookupError } = await db
      .from("mcp_trade_requests")
      .select("id, user_id, connection_id, payload, status")
      .eq("id", data.requestId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (lookupError) throw toApiError(lookupError);
    if (!proposal) throw notFound("That trade proposal was not found.");
    if (proposal.status !== "PENDING_APPROVAL") {
      throw conflict("This trade proposal has already been reviewed.");
    }

    if (!data.approve) {
      const { data: rejected, error } = await db
        .from("mcp_trade_requests")
        .update({
          status: "REJECTED",
          decision_reason: "Rejected by the account owner.",
          decided_at: new Date().toISOString(),
        })
        .eq("id", data.requestId)
        .eq("user_id", context.userId)
        .eq("status", "PENDING_APPROVAL")
        .select("id")
        .maybeSingle();
      if (error) throw toApiError(error);
      if (!rejected) throw conflict("This trade proposal has already been reviewed.");
      await recordAudit({
        userId: context.userId,
        action: "MCP_TRADE_REJECTED",
        entityType: "mcp_trade_request",
        entityId: data.requestId,
      });
      return { status: "REJECTED" as const };
    }

    const { data: claimed, error: claimError } = await db
      .from("mcp_trade_requests")
      .update({ status: "APPROVING" })
      .eq("id", data.requestId)
      .eq("user_id", context.userId)
      .eq("status", "PENDING_APPROVAL")
      .select("id")
      .maybeSingle();
    if (claimError) throw toApiError(claimError);
    if (!claimed) throw conflict("This trade proposal has already been reviewed.");

    const parsedRequest = tradeExecutionRequestSchema.safeParse(proposal.payload);
    if (!parsedRequest.success || parsedRequest.data.connectionId !== proposal.connection_id) {
      const { error } = await db
        .from("mcp_trade_requests")
        .update({
          status: "FAILED",
          decision_reason: "The stored trade proposal is invalid.",
          decided_at: new Date().toISOString(),
        })
        .eq("id", data.requestId);
      if (error) throw toApiError(error);
      throw conflict("This trade proposal is invalid and was not sent to MT5.");
    }

    let result;
    try {
      result = await executeTradeCommand(context.userId, parsedRequest.data);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "The trade command could not be submitted.";
      const { error: updateError } = await db
        .from("mcp_trade_requests")
        .update({
          status: "FAILED",
          decision_reason: reason,
          decided_at: new Date().toISOString(),
        })
        .eq("id", data.requestId);
      if (updateError) throw toApiError(updateError);
      throw error;
    }

    const failed = result.status === "REJECTED" || result.status === "FAILED";
    const { error: resultError } = await db
      .from("mcp_trade_requests")
      .update({
        status: failed ? "FAILED" : "APPROVED",
        command_id: result.commandId,
        decision_reason: result.message ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (resultError) throw toApiError(resultError);

    await recordAudit({
      userId: context.userId,
      action: failed ? "MCP_TRADE_APPROVAL_BLOCKED" : "MCP_TRADE_APPROVED",
      entityType: "mcp_trade_request",
      entityId: data.requestId,
      metadata: { commandId: result.commandId, status: result.status },
    });
    return { status: failed ? ("FAILED" as const) : ("APPROVED" as const), result };
  });
