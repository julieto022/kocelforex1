import { supabase } from "@/integrations/supabase/client";

export type RegisterInput = {
  fullName: string;
  username: string;
  email: string;
  password: string;
  country: string;
  phone: string;
  referralCode?: string | undefined;
};

export async function register(input: RegisterInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/onboarding`,
      data: {
        full_name: input.fullName,
        username: input.username,
        country: input.country,
        phone: input.phone,
        referral_code: input.referralCode ?? null,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function login(identifier: string, password: string) {
  // Kocel accounts authenticate against Kocel only — never a broker.
  const { data, error } = await supabase.auth.signInWithPassword({
    email: identifier,
    password,
  });
  if (error) throw error;
  return data;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  // Response is intentionally identical whether or not the account exists.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
