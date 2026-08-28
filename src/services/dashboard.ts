import type { AccountSummary, BrokerConnection } from "./types";

export type DashboardData = {
  live: boolean;
  summary: AccountSummary | null;
  message?: string;
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
  return {
    live: false,
    summary: null,
    message: "Waiting for the Kocel Bridge EA to deliver account figures.",
  };
}
