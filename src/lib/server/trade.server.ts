/**
 * Trade execution service. Server-only: processes trade commands, validates them,
 * stores them in the database, and handles results from the Bridge EA.
 */

import { z } from "zod";

import { ApiError, forbidden, notFound } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import type {
  TradeExecutionRequest,
  TradeExecutionResult,
  BridgeTradeCommand,
  BridgeCommandPollResponse,
  BridgeCommandResultRequest,
  TradeCommandStatus,
  TradeOperation,
} from "@/lib/contracts/broker";
import { recordAudit } from "@/lib/server/audit.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Validates trade execution request */
export const tradeExecutionRequestSchema = z
  .object({
    connectionId: z.string().uuid(),
    operation: z.enum(["OPEN_MARKET", "CLOSE_POSITION", "MODIFY_POSITION", "CANCEL_PENDING_ORDER"]),
    symbol: z.string().trim().min(1).max(32).optional(),
    side: z.enum(["BUY", "SELL"]).optional(),
    volume: z.number().positive().optional(),
    stopLoss: z.number().optional(),
    takeProfit: z.number().optional(),
    positionTicket: z.number().int().positive().optional(),
    orderTicket: z.number().int().positive().optional(),
    clientRequestId: z.string().uuid(),
  })
  .superRefine((request, ctx) => {
    switch (request.operation) {
      case "OPEN_MARKET":
        if (!request.symbol) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["symbol"], message: "Symbol is required." });
        }
        if (!request.side) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["side"], message: "Side is required." });
        }
        if (!request.volume || request.volume <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["volume"], message: "Volume must be positive." });
        }
        break;
      case "CLOSE_POSITION":
        if (!request.positionTicket || request.positionTicket <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["positionTicket"], message: "Position ticket is required." });
        }
        break;
      case "MODIFY_POSITION":
        if (!request.positionTicket || request.positionTicket <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["positionTicket"], message: "Position ticket is required." });
        }
        if (request.stopLoss === undefined && request.takeProfit === undefined) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one of stopLoss or takeProfit must be provided." });
        }
        break;
      case "CANCEL_PENDING_ORDER":
        if (!request.orderTicket || request.orderTicket <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["orderTicket"], message: "Order ticket is required." });
        }
        break;
      default:
        break;
    }
  });

export type TradeExecutionRequestValidated = z.infer<typeof tradeExecutionRequestSchema>;

/** Validates bridge command result from EA */
export const bridgeCommandResultSchema = z.object({
  commandId: z.string().uuid(),
  status: z.enum(["EXECUTED", "FAILED", "REJECTED"]),
  mt5Ticket: z.number().int().positive().optional(),
  dealTicket: z.number().int().positive().optional(),
  executedVolume: z.number().positive().optional(),
  executedPrice: z.number().positive().optional(),
  errorCode: z.string().trim().max(50).optional(),
  message: z.string().trim().max(300).optional(),
});

export async function executeTradeCommand(
  userId: string,
  request: TradeExecutionRequestValidated,
): Promise<TradeExecutionResult> {
  const db = await admin();
  const now = new Date().toISOString();
  const commandId = crypto.randomUUID();

  // Validate connection ownership
  const { data: connection } = await db
    .from("broker_connections")
    .select("id, user_id, status")
    .eq("id", request.connectionId)
    .maybeSingle();

  if (!connection) throw notFound("Connection not found.");
  if (connection.user_id !== userId) throw forbidden("You do not own this connection.");

  // Connection must be active and backed by a current Bridge session
  const { data: activeBridgeSession } = await db
    .from("bridge_sessions")
    .select("id, expires_at, revoked_at")
    .eq("connection_id", request.connectionId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeBridgeSession) {
    return {
      commandId,
      status: "REJECTED",
      errorCode: "BRIDGE_SESSION_REQUIRED",
      message: "This MT5 connection does not have an active Bridge session.",
    };
  }

  // Connection must be active
  if (connection.status !== "CONNECTED") {
    return {
      commandId,
      status: "REJECTED",
      errorCode: "CONNECTION_NOT_ACTIVE",
      message: "The MT5 Bridge is not currently connected.",
    };
  }

  // Validate operation-specific requirements
  const validationError = validateTradeOperation(request);
  if (validationError) {
    return {
      commandId,
      status: "REJECTED",
      errorCode: validationError.code,
      message: validationError.message,
    };
  }

  // Check for duplicate execution (idempotency)
  const { data: existing } = await (
    db.from("mt5_trade_commands") as any
  )
    .select("id, status, client_request_id")
    .eq("connection_id", request.connectionId)
    .eq("client_request_id", request.clientRequestId)
    .maybeSingle();

  if (existing) {
    // If already executed, return the result
    if (existing.status === "EXECUTED" || existing.status === "FAILED") {
      return {
        commandId: existing.id,
        status: existing.status as TradeCommandStatus,
        message: "This command was already processed.",
      };
    }
    // If still pending/sent, return the same command ID to prevent re-execution
    return {
      commandId: existing.id,
      status: existing.status as TradeCommandStatus,
      message: "This command is already being processed.",
    };
  }

  // Create the trade command record
  const { data: command, error } = await (
    db.from("mt5_trade_commands") as any
  )
    .insert({
      id: commandId,
      user_id: userId,
      connection_id: request.connectionId,
      client_request_id: request.clientRequestId,
      operation: request.operation,
      symbol: request.symbol ?? null,
      side: request.side ?? null,
      requested_volume: request.volume ?? null,
      requested_stop_loss: request.stopLoss ?? null,
      requested_take_profit: request.takeProfit ?? null,
      position_ticket: request.positionTicket ?? null,
      order_ticket: request.orderTicket ?? null,
      status: "PENDING",
      requested_at: now,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(), // 5 minute expiry
    })
    .select("id, status")
    .single();

  if (error || !command) {
    logger.error("database", "Failed to insert MT5 trade command", {
      error: error
        ? {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          }
        : { message: "Insert returned no command." },
      commandId,
      connectionId: request.connectionId,
      operation: request.operation,
    });

    throw new ApiError("SERVICE_UNAVAILABLE", getTradeCommandStorageError(error));
  }

  // Record audit (using CONNECTION_AUTHORIZED as proxy for trade action)
  await recordAudit({
    userId,
    action: "CONNECTION_AUTHENTICATED",
    entityType: "broker_connection",
    entityId: request.connectionId,
  });

  logger.warn("bridge", "command created", { commandId, operation: request.operation });

  return {
    commandId,
    status: "PENDING",
    message: "Trade command queued for execution.",
  };
}

function getTradeCommandStorageError(
  error: { code?: string; message?: string; details?: string | null; hint?: string | null } | null,
): string {
  switch (error?.code) {
    case "PGRST205":
    case "42P01":
      return "The trade-command storage is not available yet. Please try again shortly.";
    case "42703":
      return "The trade-command storage schema is out of date. The team has been notified.";
    case "42501":
      return "The server is not permitted to write trade commands.";
    case "23505":
      return "This trade request was already submitted. Retry with a new request ID.";
    case "23503":
      return "The selected MT5 connection is no longer available. Reconnect the account and try again.";
    case "23514":
      return "The trade request contains an unsupported operation, side, or status value.";
    case "22P02":
      return "The trade request contains an invalid value. Check the symbol, volume, and ticket fields.";
    default:
      return error?.message
        ? `The trade command could not be stored (${error.code ?? "unknown"}).`
        : "The trade command could not be stored. Please try again.";
  }
}

/** Validates operation-specific requirements */
function validateTradeOperation(
  request: TradeExecutionRequestValidated,
): { code: string; message: string } | null {
  switch (request.operation) {
    case "OPEN_MARKET":
      if (!request.symbol) return { code: "INVALID_SYMBOL", message: "Symbol is required." };
      if (!request.side) return { code: "INVALID_SIDE", message: "Side (BUY/SELL) is required." };
      if (!request.volume || request.volume <= 0)
        return { code: "INVALID_VOLUME", message: "Volume must be positive." };
      return null;

    case "CLOSE_POSITION":
      if (!request.positionTicket)
        return { code: "INVALID_TICKET", message: "Position ticket is required." };
      return null;

    case "MODIFY_POSITION":
      if (!request.positionTicket)
        return { code: "INVALID_TICKET", message: "Position ticket is required." };
      if (
        (request.stopLoss === undefined || request.stopLoss === null) &&
        (request.takeProfit === undefined || request.takeProfit === null)
      ) {
        return { code: "INVALID_PARAMS", message: "At least SL or TP must be provided." };
      }
      return null;

    case "CANCEL_PENDING_ORDER":
      if (!request.orderTicket)
        return { code: "INVALID_TICKET", message: "Order ticket is required." };
      return null;

    default:
      return { code: "UNKNOWN_OPERATION", message: "Unknown operation." };
  }
}

/** Retrieves pending commands for the authenticated connection (Bridge EA) */
export async function getPendingCommandsForBridge(
  connectionId: string,
): Promise<BridgeCommandPollResponse> {
  const db = await admin();
  const now = new Date();

  // Fetch non-expired commands in PENDING or SENT state
  const { data: commands, error } = await (
    db.from("mt5_trade_commands") as any
  )
    .select(
      "id, operation, symbol, side, requested_volume, requested_stop_loss, requested_take_profit, position_ticket, order_ticket, client_request_id, requested_at",
    )
    .eq("connection_id", connectionId)
    .in("status", ["PENDING", "SENT"])
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    logger.warn("bridge", "Failed to fetch commands", { error: (error as any).message, connectionId });
    return { commands: [], lastPollAt: now.toISOString() };
  }

  // Update status to SENT for commands being returned to EA
  if (commands && commands.length > 0) {
    const commandIds = commands.map((c: any) => c.id);
    await (
      db.from("mt5_trade_commands") as any
    )
      .update({ status: "SENT", sent_at: now.toISOString() })
      .in("id", commandIds);
  }

  const bridgeCommands: BridgeTradeCommand[] = (commands || []).map((cmd: any) => ({
    commandId: cmd.id,
    operation: cmd.operation as TradeOperation,
    symbol: cmd.symbol ?? undefined,
    side: cmd.side ? (cmd.side as "BUY" | "SELL") : undefined,
    volume: cmd.requested_volume ?? undefined,
    stopLoss: cmd.requested_stop_loss ?? undefined,
    takeProfit: cmd.requested_take_profit ?? undefined,
    positionTicket: cmd.position_ticket ?? undefined,
    orderTicket: cmd.order_ticket ?? undefined,
    clientRequestId: cmd.client_request_id,
    requestedAt: cmd.requested_at,
  }));

  return {
    commands: bridgeCommands,
    lastPollAt: now.toISOString(),
  };
}

/** Handles trade execution result from the EA (Bridge) */
export async function recordTradeExecutionResult(
  connectionId: string,
  result: z.infer<typeof bridgeCommandResultSchema>,
): Promise<void> {
  const db = await admin();
  const now = new Date().toISOString();

  // Verify command exists and belongs to this connection
  const { data: command } = await (
    db.from("mt5_trade_commands") as any
  )
    .select("id, user_id, status, connection_id")
    .eq("id", result.commandId)
    .maybeSingle();

  if (!command) throw notFound("Command not found.");
  if (command.connection_id !== connectionId)
    throw forbidden("Command does not belong to this connection.");

  // Prevent duplicate result recording
  if (["EXECUTED", "FAILED", "REJECTED", "EXPIRED", "CANCELLED"].includes(command.status)) {
    logger.warn("bridge", "Attempted to record result for already-completed command", {
      commandId: result.commandId,
      existingStatus: command.status,
    });
    return;
  }

  // Update command with result
  const updateData: Record<string, string | number | null> = {
    status: result.status,
    executed_at: now,
    completed_at: now,
  };

  if (result.mt5Ticket) updateData.mt5_ticket = result.mt5Ticket;
  if (result.dealTicket) updateData.mt5_deal_ticket = result.dealTicket;
  if (result.executedVolume) updateData.executed_volume = result.executedVolume;
  if (result.executedPrice) updateData.executed_price = result.executedPrice;
  if (result.errorCode) updateData.error_code = result.errorCode;
  if (result.message) updateData.error_message = result.message;

  const { error } = await (
    db.from("mt5_trade_commands") as any
  )
    .update(updateData)
    .eq("id", result.commandId);

  if (error) {
    throw new ApiError("INTERNAL_ERROR", "Failed to record trade result.");
  }

  // Record audit event
  await recordAudit({
    userId: command.user_id,
    action: "CONNECTION_AUTHENTICATED",
    entityType: "mt5_trade_command",
    entityId: result.commandId,
    metadata: {
      status: result.status,
      errorCode: result.errorCode,
    },
  });

  logger.info("trade", "result recorded", {
    commandId: result.commandId,
    status: result.status,
  });
}

/** Marks expired commands as EXPIRED */
export async function expireStaleCommands(): Promise<number> {
  const db = await admin();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("mt5_trade_commands")
    .update({ status: "EXPIRED", completed_at: now })
    .in("status", ["PENDING", "SENT"])
    .lt("expires_at", now)
    .select("id");

  if (error) {
    logger.error("trade", "Failed to expire stale commands", { error });
    return 0;
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    logger.info("trade", "expired commands", { count });
  }

  return count;
}
