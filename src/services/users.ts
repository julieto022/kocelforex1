import { supabase } from "@/integrations/supabase/client";
import {
  updateProfile as updateProfileFn,
  updateSettings as updateSettingsFn,
} from "@/lib/functions/settings.functions";
import type { NotificationPreferences, Profile, UserSettings } from "./types";

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Profile) ?? null;
}

export async function updateProfile(_userId: string, patch: Partial<Profile>) {
  await updateProfileFn({ data: patch as never });
}

export async function completeOnboarding(userId: string) {
  await updateProfile(userId, { onboarding_completed: true } as Partial<Profile>);
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

export async function updateSettings(_userId: string, patch: Partial<UserSettings>) {
  await updateSettingsFn({ data: patch as never });
}

export async function updateNotificationPreferences(
  userId: string,
  notifications: NotificationPreferences,
) {
  await updateSettings(userId, { notifications } as Partial<UserSettings>);
}
