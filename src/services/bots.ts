import { supabase } from "@/integrations/supabase/client";
import {
  createBot as createBotFn,
  deleteBot as deleteBotFn,
  setBotStatus as setBotStatusFn,
  updateBot as updateBotFn,
} from "@/lib/functions/bots.functions";
import type { Bot } from "./types";

export type CreateBotInput = {
  name: string;
  symbol: string;
  riskProfile: string;
  brokerConnectionId: string | null;
  strategyId: string | null;
  timeframe?: string | null;
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

export async function createBot(_userId: string, input: CreateBotInput): Promise<Bot> {
  const bot = await createBotFn({
    data: {
      name: input.name,
      symbol: input.symbol,
      riskProfile: input.riskProfile.toUpperCase() as "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE",
      timeframe: input.timeframe ?? null,
      brokerConnectionId: input.brokerConnectionId,
      strategyId: input.strategyId,
      configuration: {},
    },
  });
  return bot as unknown as Bot;
}

export async function updateBot(id: string, patch: { name?: string; timeframe?: string | null }) {
  await updateBotFn({ data: { botId: id, ...patch } });
}

export async function deleteBot(id: string) {
  await deleteBotFn({ data: { botId: id } });
}

/** Records the requested run-state; the Bridge EA performs the actual execution. */
export async function setBotStatus(id: string, status: Bot["status"]) {
  await setBotStatusFn({
    data: { botId: id, status: String(status).toUpperCase() as never },
  });
}
