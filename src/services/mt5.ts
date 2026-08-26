import { supabase } from "@/integrations/supabase/client";
import {
  disconnectConnection as disconnectConnectionFn,
  revokeConnection as revokeConnectionFn,
  renameConnection as renameConnectionFn,
} from "@/lib/functions/mt5.functions";
import type { BrokerConnection } from "./types";

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

async function requireConnection(id: string): Promise<BrokerConnection> {
  const connection = await getMT5Connection(id);
  if (!connection) throw new Error("We couldn't load that connection.");
  return connection;
}

export async function renameMT5Connection(id: string, nickname: string) {
  await renameConnectionFn({ data: { connectionId: id, nickname } });
}

export async function revokeMT5Connection(id: string) {
  await revokeConnectionFn({ data: { connectionId: id } });
}

/** Disconnecting removes the account from the Kocel workspace. It never closes MT5 trades. */
export async function disconnectMT5(id: string) {
  await disconnectConnectionFn({ data: { connectionId: id } });
}

export function maskLogin(login: string) {
  if (login.length <= 4) return `••••${login}`;
  return `••••••${login.slice(-4)}`;
}
