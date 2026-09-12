import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { invalid, toApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/server/audit.server";

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw toApiError(error);
    if (data) return data;

    const fallback = {
      user_id: userId,
      theme: "system",
      timezone: "UTC",
      language: "en",
      date_format: "YYYY-MM-DD",
      default_currency: "USD",
      default_risk_profile: "BALANCED",
      active_connection_id: null,
      notifications: { trade: true, bot: true, connection: true, risk: true, email: true, push: true },
    };

    const { data: created, error: createError } = await supabase
      .from("user_settings")
      .upsert(fallback as never, { onConflict: "user_id" })
      .select()
      .maybeSingle();
    if (createError) throw toApiError(createError);
    return created ?? fallback;
  });

export const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  timezone: z.string().trim().max(64).optional(),
  language: z.string().trim().max(16).optional(),
  date_format: z.string().trim().max(24).optional(),
  default_currency: z.string().trim().max(8).optional(),
  default_risk_profile: z
    .preprocess(
      (value) => (typeof value === "string" ? value.toUpperCase() : value),
      z.enum(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"]),
    )
    .optional(),
  active_connection_id: z.string().uuid().nullish(),
  notifications: z.record(z.string(), z.unknown()).optional(),
});

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => settingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(patch).length === 0) throw invalid("Nothing to update.");

    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, ...patch } as never, { onConflict: "user_id" });
    if (error) throw toApiError(error);
    return { ok: true as const };
  });

const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(80).optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_.]+$/)
    .optional(),
  phone: z.string().trim().max(24).nullish(),
  country: z.string().trim().max(60).nullish(),
  avatar_url: z.string().url().max(500).nullish(),
  onboarding_completed: z.boolean().optional(),
});

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw toApiError(error);
    return data;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => profileSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(patch).length === 0) throw invalid("Nothing to update.");

    const { error } = await supabase
      .from("profiles")
      .update(patch as never)
      .eq("id", userId);
    if (error) {
      if (error.message.includes("duplicate")) throw invalid("That username is already taken.");
      throw toApiError(error);
    }
    return { ok: true as const };
  });

/**
 * Soft-deletes the account: the profile is anonymised, sessions revoked and
 * connections removed. Auth deletion is handled separately by support.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ confirmation: z.literal("DELETE") }).parse(data))
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("soft_delete_account", { _user_id: userId });
    if (error) throw toApiError(error);
    await recordAudit({ userId, action: "ACCOUNT_DELETION_REQUESTED", entityType: "profile" });
    return { ok: true as const };
  });
