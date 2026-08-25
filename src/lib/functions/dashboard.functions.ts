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
  .inputValidator((data: unknown) =>
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
      ? Date.now() - new Date(row.last_seen_at).getTime() >
        BRIDGE_HEARTBEAT_TIMEOUT_SECONDS * 1000
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
