import { supabase } from "@/integrations/supabase/client";
import type { BrokerConnection } from "./types";

export type CreateConnectionInput = {
  brokerId: string;
  accountName: string;
  mt5Login: string;
  server: string;
  accountType?: string | undefined;
  environment: "demo" | "real";
  nickname?: string | undefined;
};

const SELECT = "*, broker:brokers(*)";

export async function getMT5Connections(userId: string): Promise<BrokerConnection[]> {
  const { data, error } = await supabase
    .from("broker_connections")
    .select(SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as BrokerConnection[];
}

export async function getMT5Connection(id: string): Promise<BrokerConnection | null> {
  const { data, error } = await supabase
    .from("broker_connections")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as BrokerConnection) ?? null;
}

/**
 * Phase 1: the connection code is generated client-side for the setup workflow.
 * Phase 2 replaces this with a backend-issued, single-use code.
 */
export function generateConnectionCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from(
      { length: 4 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("");
  return `KCL-${block()}-${block()}`;
}

export async function createMT5Connection(
  userId: string,
  input: CreateConnectionInput,
): Promise<BrokerConnection> {
  const { data, error } = await supabase
    .from("broker_connections")
    .insert({
      user_id: userId,
      broker_id: input.brokerId,
      account_name: input.accountName,
      nickname: input.nickname ?? null,
      mt5_login: input.mt5Login,
      server: input.server,
      account_type: input.accountType ?? null,
      environment: input.environment,
      status: "WAITING_FOR_BRIDGE",
      connection_code: generateConnectionCode(),
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as unknown as BrokerConnection;
}

export async function renameMT5Connection(id: string, nickname: string) {
  const { error } = await supabase.from("broker_connections").update({ nickname }).eq("id", id);
  if (error) throw error;
}

export async function regenerateConnectionCode(id: string) {
  const { error } = await supabase
    .from("broker_connections")
    .update({ connection_code: generateConnectionCode(), status: "WAITING_FOR_BRIDGE" })
    .eq("id", id);
  if (error) throw error;
}

/** Disconnecting removes the account from the Kocel workspace. It never closes MT5 trades. */
export async function disconnectMT5(id: string) {
  const { error } = await supabase.from("broker_connections").delete().eq("id", id);
  if (error) throw error;
}

export function maskLogin(login: string) {
  if (login.length <= 4) return `••••${login}`;
  return `••••••${login.slice(-4)}`;
}
