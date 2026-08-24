import { supabase } from "@/integrations/supabase/client";
import type { NotificationPreferences, Profile, UserSettings } from "./types";

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data as unknown as Profile) ?? null;
}

export async function updateProfile(userId: string, patch: Partial<Profile>) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

export async function completeOnboarding(userId: string) {
  await updateProfile(userId, { onboarding_completed: true });
}

export async function getSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as UserSettings) ?? null;
}

export async function updateSettings(userId: string, patch: Partial<UserSettings>) {
  const { error } = await supabase
    .from("user_settings")
    .update(patch as never)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateNotificationPreferences(
  userId: string,
  notifications: NotificationPreferences,
) {
  await updateSettings(userId, { notifications });
}
