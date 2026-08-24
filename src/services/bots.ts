import { supabase } from "@/integrations/supabase/client";
import type { Bot } from "./types";

export type CreateBotInput = {
  name: string;
  symbol: string;
  riskProfile: string;
  brokerConnectionId: string | null;
  strategyId: string | null;
};

export async function getBots(userId: string): Promise<Bot[]> {
  const { data, error } = await supabase
    .from("bots")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Bot[];
}

export async function createBot(userId: string, input: CreateBotInput): Promise<Bot> {
  const { data, error } = await supabase
    .from("bots")
    .insert({
      user_id: userId,
      name: input.name,
      symbol: input.symbol,
      risk_profile: input.riskProfile,
      broker_connection_id: input.brokerConnectionId,
      strategy_id: input.strategyId,
      status: "stopped",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Bot;
}

export async function deleteBot(id: string) {
  const { error } = await supabase.from("bots").delete().eq("id", id);
  if (error) throw error;
}

/** Phase 2 owns real execution. Phase 1 only records intent. */
export async function setBotStatus(id: string, status: Bot["status"]) {
  const { error } = await supabase.from("bots").update({ status }).eq("id", id);
  if (error) throw error;
}
