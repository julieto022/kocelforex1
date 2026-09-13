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

export type ValidateBotInput = {
  name?: string;
  symbol?: string;
  strategyId?: string | null;
  connectionId?: string | null;
};

export function validateBotInput(input: ValidateBotInput): { ok: true } | { ok: false; message: string } {
  const name = (input.name ?? "").trim();
  const symbol = (input.symbol ?? "").trim();
  const strategyId = (input.strategyId ?? "").trim();
  const connectionId = (input.connectionId ?? "").trim();

  if (!name || name.length < 2 || !strategyId || !connectionId || !symbol || symbol.length < 2) {
    return {
      ok: false,
      message: "Enter a bot name, choose one strategy, and select an MT5 account.",
    };
  }

  return { ok: true };
}

export async function getBotById(id: string): Promise<Bot | null> {
  const { data, error } = await supabase
    .from("bots")
    .select(
      `*, strategy:strategies(id, name, category, short_description), broker_connection:broker_connections(id, account_name, status, broker_name)`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Bot) ?? null;
}

export async function getBots(userId: string): Promise<Bot[]> {
  const { data, error } = await supabase
    .from("bots")
    .select(
      `*, strategy:strategies(id, name, category, short_description), broker_connection:broker_connections(id, account_name, status, broker_name)`
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Bot[];
}

export async function createBot(_userId: string, input: CreateBotInput): Promise<Bot> {
  const validation = validateBotInput({
    name: input.name,
    symbol: input.symbol,
    strategyId: input.strategyId,
    connectionId: input.brokerConnectionId,
  });
  if (!validation.ok) throw new Error(validation.message);

  const bot = await createBotFn({
    data: {
      name: input.name.trim(),
      symbol: input.symbol.trim().toUpperCase(),
      riskProfile: input.riskProfile.toUpperCase() as "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE",
      timeframe: input.timeframe ?? null,
      brokerConnectionId: input.brokerConnectionId,
      strategyId: input.strategyId,
      configuration: {},
    },
  });
  return bot as unknown as Bot;
}

export async function updateBot(
  id: string,
  patch: {
    name?: string;
    symbol?: string;
    timeframe?: string | null;
    strategyId?: string | null;
    brokerConnectionId?: string | null;
    riskProfile?: string;
  },
) {
  const next = { ...patch };
  if (next.name !== undefined) next.name = next.name.trim();
  if (next.symbol !== undefined) next.symbol = next.symbol.trim().toUpperCase();
  if (next.riskProfile !== undefined) {
    next.riskProfile = next.riskProfile.toUpperCase() as "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";
  }
  await updateBotFn({
    data: {
      botId: id,
      name: next.name,
      symbol: next.symbol,
      timeframe: next.timeframe,
      riskProfile: next.riskProfile,
      strategyId: next.strategyId,
      brokerConnectionId: next.brokerConnectionId,
    },
  });
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
