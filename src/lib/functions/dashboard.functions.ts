import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BRIDGE_HEARTBEAT_TIMEOUT_SECONDS } from "@/lib/api/constants";
import { toApiError } from "@/lib/api/errors";

export type DashboardOverview = {
  live: boolean;
  message: string | null;
  connection: {
    id: string;
    account_name: string;
    status: string;
    last_seen_at: string | null;
    stale: boolean;
  } | null;
  counts: { bots: number; runningBots: number; openTrades: number; unreadNotifications: number };
};

/**
 * Aggregates the dashboard header in one round trip. Account figures stay
 * absent until the Bridge EA reports them — Kocel never invents numbers.
 */
export const getDashboardOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ connectionId: z.string().uuid().nullish() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<DashboardOverview> => {
    const { supabase, userId } = context;

    let connectionQuery = supabase
      .from("broker_connections")
      .select("id, account_name, status, last_seen_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (data.connectionId) connectionQuery = connectionQuery.eq("id", data.connectionId);

    const [connections, bots, trades, notifications] = await Promise.all([
      connectionQuery,
      supabase.from("bots").select("id, status").eq("user_id", userId),
      supabase.from("trades").select("id").eq("user_id", userId).eq("status", "OPEN"),
      supabase.from("notifications").select("id").eq("user_id", userId).eq("read", false),
    ]);

    for (const result of [connections, bots, trades, notifications]) {
      if (result.error) throw toApiError(result.error);
    }

    const row = connections.data?.[0] ?? null;
    const stale = row?.last_seen_at
      ? Date.now() - new Date(row.last_seen_at).getTime() > BRIDGE_HEARTBEAT_TIMEOUT_SECONDS * 1000
      : true;

    const live = Boolean(row && row.status === "CONNECTED" && !stale);

    return {
      live,
      message: row
        ? live
          ? null
          : "Waiting for the Kocel Bridge EA to report this account."
        : "Connect an MT5 account to see live account information.",
      connection: row ? { ...row, stale } : null,
      counts: {
        bots: bots.data?.length ?? 0,
        runningBots: (bots.data ?? []).filter((bot) => bot.status === "RUNNING").length,
        openTrades: trades.data?.length ?? 0,
        unreadNotifications: notifications.data?.length ?? 0,
      },
    };
  });

export type Mt5AccountSnapshotData = {
  balance: number | null;
  equity: number | null;
  margin: number | null;
  free_margin: number | null;
  margin_level: number | null;
  profit: number | null;
  credit: number | null;
  currency: string | null;
  leverage: number | null;
  snapshot_at: string | null;
};

export type Mt5Position = {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  currentProfit: number | null;
  swap: number | null;
  magic: number | null;
  openTime: string | null;
};

export type Mt5Order = {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  price: number;
  stopLoss: number | null;
  takeProfit: number | null;
  currentState: string;
  magic: number | null;
  createdAt: string | null;
};

/**
 * Fetches the latest MT5 account snapshot from Phase 3.3 synchronization.
 */
export const getDashboardAccountSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ connectionId: z.string().uuid() }).parse(data ?? {}))
  .handler(async ({ data, context }): Promise<Mt5AccountSnapshotData | null> => {
    const { supabase, userId } = context;

    // Verify connection ownership
    const { data: connection, error: connError } = await supabase
      .from("broker_connections")
      .select("id, user_id")
      .eq("id", data.connectionId)
      .maybeSingle();

    if (connError) throw toApiError(connError);
    if (!connection || connection.user_id !== userId) {
      throw new Error("Connection not found");
    }

    // Fetch latest snapshot
    const { data: snapshot, error } = await supabase
      .from("mt5_account_snapshots")
      .select(
        "balance, equity, margin, free_margin, margin_level, profit, credit, currency, leverage, snapshot_at",
      )
      .eq("broker_connection_id", data.connectionId)
      .eq("user_id", userId)
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw toApiError(error);
    return snapshot as Mt5AccountSnapshotData | null;
  });

/**
 * Fetches current open positions from Phase 3.3 synchronization.
 */
export const getDashboardPositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ connectionId: z.string().uuid() }).parse(data ?? {}))
  .handler(async ({ data, context }): Promise<Mt5Position[]> => {
    const { supabase, userId } = context;

    // Verify connection ownership
    const { data: connection, error: connError } = await supabase
      .from("broker_connections")
      .select("id, user_id")
      .eq("id", data.connectionId)
      .maybeSingle();

    if (connError) throw toApiError(connError);
    if (!connection || connection.user_id !== userId) {
      throw new Error("Connection not found");
    }

    // Fetch open positions - select actual columns and transform
    const { data: positions, error } = await supabase
      .from("mt5_open_positions")
      .select(
        "ticket, symbol, direction, volume, open_price, current_price, stop_loss, take_profit, current_profit, swap, magic_number, opened_at",
      )
      .eq("broker_connection_id", data.connectionId)
      .eq("user_id", userId)
      .order("opened_at", { ascending: false });

    if (error) throw toApiError(error);

    // Transform to Mt5Position format
    return (positions ?? []).map((p: any) => ({
      ticket: p.ticket,
      symbol: p.symbol,
      type: p.direction,
      volume: p.volume,
      openPrice: p.open_price,
      currentPrice: p.current_price,
      stopLoss: p.stop_loss ?? null,
      takeProfit: p.take_profit ?? null,
      currentProfit: p.current_profit,
      swap: p.swap ?? null,
      magic: p.magic_number ?? null,
      openTime: p.opened_at,
    }));
  });

/**
 * Fetches pending orders from Phase 3.3 synchronization.
 */
export const getDashboardOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ connectionId: z.string().uuid() }).parse(data ?? {}))
  .handler(async ({ data, context }): Promise<Mt5Order[]> => {
    const { supabase, userId } = context;

    // Verify connection ownership
    const { data: connection, error: connError } = await supabase
      .from("broker_connections")
      .select("id, user_id")
      .eq("id", data.connectionId)
      .maybeSingle();

    if (connError) throw toApiError(connError);
    if (!connection || connection.user_id !== userId) {
      throw new Error("Connection not found");
    }

    // Fetch pending orders - select actual columns and transform
    const { data: orders, error } = await supabase
      .from("mt5_pending_orders")
      .select(
        "ticket, symbol, order_type, volume, price, stop_loss, take_profit, state, magic_number, created_at",
      )
      .eq("broker_connection_id", data.connectionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw toApiError(error);

    // Transform to Mt5Order format
    return (orders ?? []).map((o: any) => ({
      ticket: o.ticket,
      symbol: o.symbol,
      type: o.order_type,
      volume: o.volume,
      price: o.price,
      stopLoss: o.stop_loss ?? null,
      takeProfit: o.take_profit ?? null,
      currentState: o.state,
      magic: o.magic_number ?? null,
      createdAt: o.created_at,
    }));
  });
