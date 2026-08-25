import { supabase } from "@/integrations/supabase/client";
import {
  createConnection as createConnectionFn,
  disconnectConnection as disconnectConnectionFn,
  regenerateConnectionCode as regenerateConnectionCodeFn,
  renameConnection as renameConnectionFn,
} from "@/lib/functions/mt5.functions";
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

async function requireConnection(id: string): Promise<BrokerConnection> {
  const connection = await getMT5Connection(id);
  if (!connection) throw new Error("We couldn't load that connection.");
  return connection;
}

/**
 * Connection codes are issued and hashed by the backend. The plaintext value
 * exists only while the code is pending; the Bridge claim clears it.
 */
export async function createMT5Connection(
  userId: string,
  input: CreateConnectionInput,
): Promise<BrokerConnection> {
  const result = await createConnectionFn({
    data: {
      brokerId: input.brokerId,
      accountName: input.accountName,
      mt5Login: input.mt5Login,
      server: input.server,
      accountType: input.accountType ?? null,
      environment: input.environment.toUpperCase() as "DEMO" | "REAL",
      nickname: input.nickname ?? null,
    },
  });
  const connection = await requireConnection(result.id);
  return { ...connection, connection_code: result.code };
}

export async function renameMT5Connection(id: string, nickname: string) {
  await renameConnectionFn({ data: { connectionId: id, nickname } });
}

export async function regenerateConnectionCode(id: string) {
  const result = await regenerateConnectionCodeFn({ data: { connectionId: id } });
  return result.code;
}

/** Disconnecting removes the account from the Kocel workspace. It never closes MT5 trades. */
export async function disconnectMT5(id: string) {
  await disconnectConnectionFn({ data: { connectionId: id } });
}

export function maskLogin(login: string) {
  if (login.length <= 4) return `••••${login}`;
  return `••••••${login.slice(-4)}`;
}
