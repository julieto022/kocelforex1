import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toApiError } from "@/lib/api/errors";

export const getMt5Positions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ connectionId: z.string().uuid() }).parse(data ?? {}),
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

    // Fetch open positions
    const { data: positions, error } = await supabase
      .from("mt5_open_positions")
      .select(
        "ticket, symbol, direction as type, volume, open_price as openPrice, current_price as currentPrice, stop_loss as stopLoss, take_profit as takeProfit, current_profit as currentProfit, swap, magic_number as magic, opened_at as openTime"
      )
      .eq("broker_connection_id", data.connectionId)
      .eq("user_id", userId)
      .order("opened_at", { ascending: false });

    if (error) throw toApiError(error);
    return positions ?? [];
  });

export const getMt5Orders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ connectionId: z.string().uuid() }).parse(data ?? {}),
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

    // Fetch pending orders
    const { data: orders, error } = await supabase
      .from("mt5_pending_orders")
      .select(
        "ticket, symbol, order_type as type, volume, price, stop_loss as stopLoss, take_profit as takeProfit, state as currentState, magic_number as magic, created_at as createdAt"
      )
      .eq("broker_connection_id", data.connectionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw toApiError(error);
    return orders ?? [];
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
