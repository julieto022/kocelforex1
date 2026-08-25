import { supabase } from "@/integrations/supabase/client";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/functions/notifications.functions";
import type { AppNotification } from "./types";

export const NOTIFICATION_TYPES = [
  "ACCOUNT_CONNECTED",
  "ACCOUNT_DISCONNECTED",
  "BRIDGE_OFFLINE",
  "BOT_UPDATE",
  "TRADE_UPDATE",
  "RISK_ALERT",
  "SYSTEM",
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

/**
 * Notifications are written by the backend as a side effect of business events.
 * This client insert remains only for local, user-initiated reminders.
 */
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

export async function markRead(id: string) {
  await markNotificationRead({ data: { notificationId: id } });
}

export async function markAllRead(_userId: string) {
  await markAllNotificationsRead();
}
