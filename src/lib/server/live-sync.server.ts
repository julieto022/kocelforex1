/**
 * Phase 3.4 live trading-state synchronisation.
 *
 * The Bridge EA calls this roughly once per second, but only when the MT5
 * trading state actually changed. MT5 is the single source of truth: whatever
 * the terminal reports fully replaces the stored open positions and pending
 * orders for that connection, and closed deals are appended to trade history.
 *
 * Server-only module. Never imported by client code.
 */

import { z } from "zod";

import { notFound } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import type { BridgeIdentity } from "@/lib/contracts/broker";
import { bridgeTimestampSchema } from "@/lib/server/bridge.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const livePositionSchema = z.object({
  ticket: z.number().int().positive(),
  symbol: z.string().trim().min(1).max(50),
  type: z.string().trim().min(1).max(32),
  volume: z.number().positive(),
  openPrice: z.number().positive(),
  currentPrice: z.number().nonnegative(),
  stopLoss: z.number().nullable().optional(),
  takeProfit: z.number().nullable().optional(),
  currentProfit: z.number(),
  swap: z.number(),
  magic: z.number().int().nullable().optional(),
  openTime: bridgeTimestampSchema,
});

const liveOrderSchema = z.object({
  ticket: z.number().int().positive(),
  symbol: z.string().trim().min(1).max(50),
  type: z.string().trim().min(1).max(32),
  volume: z.number().positive(),
  price: z.number().nonnegative(),
  stopLoss: z.number().nullable().optional(),
  takeProfit: z.number().nullable().optional(),
  currentState: z.string().trim().min(1).max(32),
  magic: z.number().int().nullable().optional(),
  createdAt: bridgeTimestampSchema,
});

const closedTradeSchema = z.object({
  ticket: z.number().int().positive(),
  positionTicket: z.number().int().positive().nullable().optional(),
  dealTicket: z.number().int().positive().nullable().optional(),
  orderTicket: z.number().int().positive().nullable().optional(),
  symbol: z.string().trim().min(1).max(50),
  type: z.string().trim().min(1).max(32),
  volume: z.number().positive(),
  entryPrice: z.number().nonnegative().nullable().optional(),
  exitPrice: z.number().nonnegative().nullable().optional(),
  profit: z.number(),
  commission: z.number().nullable().optional(),
  swap: z.number().nullable().optional(),
  netProfit: z.number().nullable().optional(),
  openedAt: bridgeTimestampSchema.nullable().optional(),
  closedAt: bridgeTimestampSchema,
});

export const bridgeLiveSyncSchema = z.object({
  account: z
    .object({
      balance: z.number(),
      equity: z.number(),
      margin: z.number(),
      freeMargin: z.number(),
      marginLevel: z.number().nullable().optional(),
      profit: z.number().nullable().optional(),
      credit: z.number().nullable().optional(),
      currency: z.string().trim().min(3).max(8).nullable().optional(),
      leverage: z.number().int().nullable().optional(),
    })
    .optional(),
  positions: z.array(livePositionSchema).max(500),
  orders: z.array(liveOrderSchema).max(500).optional(),
  closedTrades: z.array(closedTradeSchema).max(200).optional(),
});

export type BridgeLiveSync = z.infer<typeof bridgeLiveSyncSchema>;

export type BridgeLiveSyncResult = {
  connectionId: string;
  syncedAt: string;
  positions: number;
  orders: number;
  closedTrades: number;
};

export async function syncLiveState(
  identity: BridgeIdentity,
  payload: BridgeLiveSync,
): Promise<BridgeLiveSyncResult> {
  const db = await admin();
  const now = new Date().toISOString();

  const { data: connection } = await db
    .from("broker_connections")
    .select("id, mt5_login, user_id")
    .eq("id", identity.connectionId)
    .maybeSingle();

  if (!connection || connection.user_id !== identity.userId) {
    throw notFound("That connection no longer exists.");
  }

  const login = connection.mt5_login;
  const account = payload.account;

  await db
    .from("broker_connections")
    .update({
      status: "CONNECTED",
      last_seen_at: now,
      last_sync_at: now,
      last_connected_at: now,
      ...(account
        ? {
            balance: account.balance,
            equity: account.equity,
            margin: account.margin,
            free_margin: account.freeMargin,
            margin_level: account.marginLevel ?? null,
            profit: account.profit ?? null,
            credit: account.credit ?? null,
            ...(account.currency ? { currency: account.currency } : {}),
            ...(account.leverage != null ? { leverage: account.leverage } : {}),
          }
        : {}),
    })
    .eq("id", identity.connectionId);

  // ---- Open positions: MT5 is authoritative, so the stored set mirrors it exactly.
  const positionTickets = payload.positions.map((p) => p.ticket);

  let deletePositions = db
    .from("mt5_open_positions")
    .delete()
    .eq("broker_connection_id", identity.connectionId)
    .eq("user_id", identity.userId);
  if (positionTickets.length > 0) {
    deletePositions = deletePositions.not("ticket", "in", `(${positionTickets.join(",")})`);
  }
  await deletePositions;

  if (payload.positions.length > 0) {
    const { error } = await db.from("mt5_open_positions").upsert(
      payload.positions.map((position) => ({
        user_id: identity.userId,
        broker_connection_id: identity.connectionId,
        mt5_login: login,
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
      })),
      { onConflict: "broker_connection_id,ticket" },
    );
    if (error) logger.error("bridge", "live sync positions failed", { error: error.message });
  }

  // ---- Pending orders (only when the EA reported them).
  let orderCount = 0;
  if (payload.orders) {
    const orderTickets = payload.orders.map((o) => o.ticket);
    let deleteOrders = db
      .from("mt5_pending_orders")
      .delete()
      .eq("broker_connection_id", identity.connectionId)
      .eq("user_id", identity.userId);
    if (orderTickets.length > 0) {
      deleteOrders = deleteOrders.not("ticket", "in", `(${orderTickets.join(",")})`);
    }
    await deleteOrders;

    if (payload.orders.length > 0) {
      const { error } = await db.from("mt5_pending_orders").upsert(
        payload.orders.map((order) => ({
          user_id: identity.userId,
          broker_connection_id: identity.connectionId,
          mt5_login: login,
          ticket: order.ticket,
          symbol: order.symbol,
          order_type: order.type,
          volume: order.volume,
          price: order.price,
          stop_loss: order.stopLoss ?? null,
          take_profit: order.takeProfit ?? null,
          state: order.currentState,
          magic_number: order.magic ?? null,
        })),
        { onConflict: "broker_connection_id,ticket" },
      );
      if (error) logger.error("bridge", "live sync orders failed", { error: error.message });
    }
    orderCount = payload.orders.length;
  }

  // ---- Closed trades: append-only history, de-duplicated by MT5 ticket.
  let closedCount = 0;
  const closedTrades = payload.closedTrades ?? [];
  if (closedTrades.length > 0) {
    const tickets = closedTrades.map((t) => String(t.ticket));
    const { data: existing } = await db
      .from("trades")
      .select("ticket")
      .eq("broker_connection_id", identity.connectionId)
      .eq("user_id", identity.userId)
      .in("ticket", tickets);

    const known = new Set((existing ?? []).map((row) => String(row.ticket)));
    const fresh = closedTrades.filter((trade) => !known.has(String(trade.ticket)));

    if (fresh.length > 0) {
      const { error } = await db.from("trades").insert(
        fresh.map((trade) => ({
          user_id: identity.userId,
          broker_connection_id: identity.connectionId,
          ticket: String(trade.ticket),
          position_ticket: typeof trade.positionTicket === "number" ? trade.positionTicket : Number(trade.ticket),
          order_ticket: typeof trade.orderTicket === "number" ? trade.orderTicket : null,
          deal_ticket: typeof trade.dealTicket === "number" ? trade.dealTicket : null,
          symbol: trade.symbol,
          type: trade.type,
          volume: trade.volume,
          entry_price: trade.entryPrice ?? null,
          exit_price: trade.exitPrice ?? null,
          profit: trade.profit,
          commission: trade.commission ?? null,
          swap: trade.swap ?? null,
          net_profit:
            trade.netProfit ?? trade.profit + (trade.commission ?? 0) + (trade.swap ?? 0),
          status: "closed",
          source: "MT5",
          opened_at: trade.openedAt ?? null,
          closed_at: trade.closedAt,
        }) as any),
      );
      if (error) {
        logger.error("bridge", "live sync closed trades failed", { error: error.message });
      } else {
        closedCount = fresh.length;
      }
    }
  }

  return {
    connectionId: identity.connectionId,
    syncedAt: now,
    positions: payload.positions.length,
    orders: orderCount,
    closedTrades: closedCount,
  };
}
