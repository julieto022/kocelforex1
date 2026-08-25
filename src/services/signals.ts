import { supabase } from "@/integrations/supabase/client";
import { SIGNAL_FACTORS, type Signal } from "./types";

export type SignalFilters = {
  symbol?: string | undefined;
  timeframe?: string | undefined;
  status?: string | undefined;
};

export const SIGNAL_TIMEFRAMES = ["M5", "M15", "M30", "H1", "H4", "D1"] as const;

function normalize(row: Record<string, unknown>): Signal {
  return {
    ...(row as unknown as Signal),
    confidence_breakdown:
      (row["confidence_breakdown"] as Record<string, number> | null) ?? null,
    analysis:
      (row["analysis"] as { name: string; status: string; note?: string | null }[] | null) ?? null,
  };
}

/**
 * Signals are generated server-side by the Kocel analysis engine.
 * The UI only reads stored rows — it never fabricates a signal.
 */
export async function getSignals(filters: SignalFilters = {}): Promise<Signal[]> {
  let query = supabase.from("signals").select("*");
  if (filters.symbol && filters.symbol !== "all") query = query.eq("symbol", filters.symbol);
  if (filters.timeframe && filters.timeframe !== "all")
    query = query.eq("timeframe", filters.timeframe);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(60);
  if (error) throw error;
  return (data ?? []).map((row) => normalize(row as unknown as Record<string, unknown>));
}

export async function getActiveSignals(limit = 5): Promise<Signal[]> {
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => normalize(row as unknown as Record<string, unknown>));
}

export async function getSignalHistory(limit = 30): Promise<Signal[]> {
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .not("result", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => normalize(row as unknown as Record<string, unknown>));
}

/** The 9 analysis dimensions; missing data stays "pending". */
export function resolveAnalysis(signal: Signal | null) {
  const stored = signal?.analysis ?? [];
  return SIGNAL_FACTORS.map((name) => {
    const match = stored.find((factor) => factor.name === name);
    return match ?? { name, status: "pending", note: null };
  });
}

export function signalTone(direction: string) {
  if (direction === "BUY") return "success" as const;
  if (direction === "SELL") return "danger" as const;
  if (direction === "EXPIRED") return "neutral" as const;
  return "warning" as const;
}

export function statusTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "expiring") return "warning" as const;
  if (status === "invalidated") return "danger" as const;
  return "neutral" as const;
}
