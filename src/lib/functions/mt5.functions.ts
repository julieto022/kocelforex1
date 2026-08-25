import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CONNECTION_CODE_TTL_MINUTES } from "@/lib/api/constants";
import { conflict, notFound, toApiError } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { recordAudit } from "@/lib/server/audit.server";
import { generateConnectionCode, hashSecretValue } from "@/lib/server/crypto.server";
import { requireOwnership } from "@/lib/server/ownership.server";
import { enforceRateLimit } from "@/lib/server/rate-limit.server";

const createSchema = z.object({
  brokerId: z.string().uuid(),
  accountName: z.string().trim().min(2).max(80),
  mt5Login: z.string().trim().regex(/^[0-9]{4,20}$/, "MT5 login must be 4-20 digits"),
  server: z.string().trim().min(2).max(120),
  accountType: z.string().trim().max(40).nullish(),
  environment: z.enum(["DEMO", "REAL"]),
  nickname: z.string().trim().max(60).nullish(),
});

export type CreatedConnection = {
  id: string;
  code: string;
  expiresAt: string;
};

function codeExpiry(): string {
  return new Date(Date.now() + CONNECTION_CODE_TTL_MINUTES * 60_000).toISOString();
}

/**
 * Creates a broker connection and issues its single-use Bridge pairing code.
 * The plaintext code is stored alongside its hash only while the code is
 * pending — the Bridge claim clears it and keeps only the hash.
 */
export const createConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }): Promise<CreatedConnection> => {
    const { supabase, userId } = context;
    await enforceRateLimit("connectionCode", userId);

    const code = generateConnectionCode();
    const codeHash = await hashSecretValue(code);
    const expiresAt = codeExpiry();

    const { data: id, error } = await supabase.rpc("create_broker_connection", {
      _user_id: userId,
      _broker_id: data.brokerId,
      _account_name: data.accountName,
      _nickname: data.nickname as unknown as string,
      _mt5_login: data.mt5Login,
      _server: data.server,
      _account_type: data.accountType as unknown as string,
      _environment: data.environment,
      _code_hash: codeHash,
      _code_expires_at: expiresAt,
    });

    if (error) {
      if (error.message.includes("DUPLICATE_CONNECTION")) {
        throw conflict("That MT5 account is already connected to your workspace.");
      }
      logger.error("connection", "create connection failed", { error: error.message });
      throw toApiError(error);
    }

    const connectionId = id as unknown as string;
    await supabase
      .from("broker_connections")
      .update({ connection_code: code })
      .eq("id", connectionId);

    logger.info("connection", "connection created", { connectionId });
    return { id: connectionId, code, expiresAt };
  });

const idSchema = z.object({ connectionId: z.string().uuid() });

/** Invalidates the previous pairing code and issues a fresh one. */
export const regenerateConnectionCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }): Promise<CreatedConnection> => {
    const { supabase, userId } = context;
    await enforceRateLimit("connectionCode", userId);
    await requireOwnership(supabase, "broker_connections", data.connectionId, userId);

    const code = generateConnectionCode();
    const expiresAt = codeExpiry();
    const { error } = await supabase
      .from("broker_connections")
      .update({
        connection_code: code,
        connection_code_hash: await hashSecretValue(code),
        connection_code_expires_at: expiresAt,
        code_state: "WAITING",
        status: "WAITING_FOR_BRIDGE",
      })
      .eq("id", data.connectionId);
    if (error) throw toApiError(error);

    await recordAudit({
      userId,
      action: "CONNECTION_CODE_REGENERATED",
      entityType: "broker_connection",
      entityId: data.connectionId,
    });
    return { id: data.connectionId, code, expiresAt };
  });

const renameSchema = idSchema.extend({ nickname: z.string().trim().min(1).max(60) });

export const renameConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => renameSchema.parse(data))
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
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOwnership(supabase, "broker_connections", data.connectionId, userId);

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

/** Current pairing state for a single connection, used by the setup wizard. */
export const getConnectionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("broker_connections")
      .select("id, status, code_state, last_seen_at, connection_code_expires_at, ea_version")
      .eq("id", data.connectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw toApiError(error);
    if (!row) throw notFound();
    return row;
  });
