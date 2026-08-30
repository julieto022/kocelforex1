import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toApiError } from "@/lib/api/errors";

export const getMt5Positions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ connectionId: z.string().uuid() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the connection belongs to the user
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

export const getMt5Orders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ connectionId: z.string().uuid() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the connection belongs to the user
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

export const getMt5AccountSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        connectionId: z.string().uuid(),
        hours: z.number().int().min(0).default(0),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the connection belongs to the user
    const { data: connection, error: connError } = await supabase
      .from("broker_connections")
      .select("id, user_id")
      .eq("id", data.connectionId)
      .maybeSingle();

    if (connError) throw toApiError(connError);
    if (!connection || connection.user_id !== userId) {
      throw new Error("Connection not found");
    }

    // Fetch latest snapshot if no hours specified, otherwise get history
    if (data.hours === 0) {
      const { data: snapshot, error } = await supabase
        .from("mt5_account_snapshots")
        .select("*")
        .eq("broker_connection_id", data.connectionId)
        .eq("user_id", userId)
        .order("snapshot_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw toApiError(error);
      return snapshot ?? null;
    } else {
      const since = new Date(Date.now() - data.hours * 60 * 60 * 1000).toISOString();
      const { data: snapshots, error } = await supabase
        .from("mt5_account_snapshots")
        .select("*")
        .eq("broker_connection_id", data.connectionId)
        .eq("user_id", userId)
        .gte("snapshot_at", since)
        .order("snapshot_at", { ascending: false });

      if (error) throw toApiError(error);
      return snapshots ?? [];
    }
  });
