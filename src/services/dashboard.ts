import type { AccountSummary, BrokerConnection } from "./types";

export type DashboardData = {
  live: boolean;
  summary: AccountSummary | null;
  message?: string;
};

/**
 * Account figures are only ever real values reported by the Kocel Bridge EA.
 * Values are populated by authenticated Bridge EA heartbeats.
 */
export async function getDashboard(connection: BrokerConnection | null): Promise<DashboardData> {
  if (!connection) {
    return {
      live: false,
      summary: null,
      message: "Connect an MT5 account to see live account information.",
    };
  }
  if (connection.status !== "CONNECTED") {
    return {
      live: false,
      summary: null,
      message: "Account information appears once the Kocel Bridge EA reports this account.",
    };
  }
  if (connection.balance !== null && connection.equity !== null) {
    return {
      live: true,
      summary: {
        balance: connection.balance,
        equity: connection.equity,
        free_margin: connection.free_margin,
        margin_level: connection.margin_level,
        today_pl: null,
        total_pl: null,
        currency: connection.currency ?? "",
      },
    };
  }
  return {
    live: true,
    summary: null,
    message: "Waiting for the Kocel Bridge EA to deliver account figures.",
  };
}
