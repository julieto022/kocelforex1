import { supabase } from "@/integrations/supabase/client";
import type { AppNotification } from "./types";

export const NOTIFICATION_TYPES = [
  "account_connected",
  "account_disconnected",
  "bridge_offline",
  "bot_started",
  "bot_stopped",
  "trade_opened",
  "trade_closed",
  "risk_warning",
  "system",
] as const;

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as AppNotification[];
}

export async function createNotification(
  userId: string,
  input: { type: string; title: string; message?: string | undefined },
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type: input.type,
    title: input.title,
    message: input.message ?? null,
  });
  if (error) throw error;
}

export async function markAllRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw error;
}
