import { supabase } from "@/integrations/supabase/client";
import type { Trade } from "./types";

export type TradeFilters = {
  connectionId?: string | null;
  symbol?: string;
  side?: string;
  status?: "open" | "closed";
};

export async function getTrades(userId: string, filters: TradeFilters = {}): Promise<Trade[]> {
  let query = supabase.from("trades").select("*").eq("user_id", userId);
  if (filters.connectionId) query = query.eq("broker_connection_id", filters.connectionId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.symbol) query = query.ilike("symbol", `%${filters.symbol}%`);
  if (filters.side) query = query.eq("type", filters.side);
  const { data, error } = await query.order("opened_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as Trade[];
}
