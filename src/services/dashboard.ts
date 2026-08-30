import type { AccountSummary, BrokerConnection } from "./types";

export type DashboardData = {
  live: boolean;
  summary: AccountSummary | null;
  message?: string | null;
};

/**
 * Account figures are only ever real values reported by the Kocel Bridge EA.
 * Until the Phase 2 bridge backend is connected this returns no figures at all.
 */
export async function getDashboard(connection: BrokerConnection | null): Promise<DashboardData> {
  if (!connection) {
    return {
      live: false,
      summary: null,
      message: "MT5 Not Connected",
    };
  }

  const stale =
    !connection.last_seen_at || Date.now() - new Date(connection.last_seen_at).getTime() > 90_000;

  if (connection.status !== "CONNECTED" || stale) {
    return {
      live: false,
      summary:
        connection.balance != null || connection.equity != null
          ? {
              balance: connection.balance,
              equity: connection.equity,
              free_margin: connection.free_margin,
              margin_level: connection.margin_level,
              today_pl: null,
              total_pl: connection.profit,
              currency: (connection.currency ?? "USD") as string,
            }
          : null,
      message: stale ? "MT5 Not Connected" : "MT5 Not Connected",
    };
  }

  const summary: AccountSummary | null =
    connection.balance == null && connection.equity == null && connection.free_margin == null
      ? null
      : {
          balance: connection.balance,
          equity: connection.equity,
          free_margin: connection.free_margin,
          margin_level: connection.margin_level,
          today_pl: null,
          total_pl: connection.profit,
          currency: (connection.currency ?? "USD") as string,
        };

  return {
    live: true,
    summary,
    message: summary ? null : "Waiting for the Kocel Bridge EA to deliver account figures.",
  };
}
