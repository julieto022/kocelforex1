import type { BrokerConnection } from "./types";

export type MarketCategory = "forex" | "metals" | "indices" | "other";

export type MarketInstrument = {
  symbol: string;
  name: string;
  category: MarketCategory;
};

/**
 * Phase 1 reference symbol list only. The authoritative instrument list must come
 * from the connected broker via the Kocel Bridge EA — no broker supports every symbol.
 */
export const REFERENCE_INSTRUMENTS: MarketInstrument[] = [
  { symbol: "EURUSD", name: "Euro / US Dollar", category: "forex" },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", category: "forex" },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", category: "forex" },
  { symbol: "AUDUSD", name: "Australian Dollar / US Dollar", category: "forex" },
  { symbol: "USDCHF", name: "US Dollar / Swiss Franc", category: "forex" },
  { symbol: "USDCAD", name: "US Dollar / Canadian Dollar", category: "forex" },
  { symbol: "NZDUSD", name: "New Zealand Dollar / US Dollar", category: "forex" },
  { symbol: "XAUUSD", name: "Gold / US Dollar", category: "metals" },
  { symbol: "XAGUSD", name: "Silver / US Dollar", category: "metals" },
  { symbol: "US30", name: "Dow Jones 30 Index", category: "indices" },
  { symbol: "NAS100", name: "Nasdaq 100 Index", category: "indices" },
  { symbol: "SPX500", name: "S&P 500 Index", category: "indices" },
  { symbol: "GER40", name: "Germany 40 Index", category: "indices" },
  { symbol: "UK100", name: "UK 100 Index", category: "indices" },
];

export const MARKET_CATEGORIES: { id: MarketCategory; label: string; note?: string }[] = [
  { id: "forex", label: "Forex" },
  { id: "metals", label: "Metals" },
  { id: "indices", label: "Indices" },
  {
    id: "other",
    label: "Other",
    note: "Commodities, crypto CFDs and stocks arrive with broker capability discovery.",
  },
];

/** Quotes require a live Bridge session. Kocel never simulates prices. */
export async function getQuotes(connection: BrokerConnection | null) {
  if (!connection || connection.status !== "CONNECTED") {
    return { available: false as const, quotes: [] };
  }
  return { available: false as const, quotes: [] };
}
