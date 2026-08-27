import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toApiError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/server/audit.server";
import { enforceRateLimit } from "@/lib/server/rate-limit.server";

const postSchema = z.object({ postId: z.string().uuid() });

export const savePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => postSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("community_saves")
      .insert({ user_id: userId, post_id: data.postId });
    // A duplicate save is a no-op, not an error.
    if (error && !error.message.includes("duplicate")) throw toApiError(error);
    return { saved: true as const };
  });

export const unsavePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => postSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("community_saves")
      .delete()
      .eq("user_id", userId)
      .eq("post_id", data.postId);
    if (error) throw toApiError(error);
    return { saved: false as const };
  });

export const listSavedPostIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("community_saves")
      .select("post_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw toApiError(error);
    return (data ?? []).map((row) => row.post_id);
  });

const reportSchema = z
  .object({
    postId: z.string().uuid().nullish(),
    commentId: z.string().uuid().nullish(),
    reason: z.enum(["SPAM", "ABUSE", "MISLEADING", "SCAM", "OTHER"]),
    details: z.string().trim().max(1000).nullish(),
  })
  .refine((value) => Boolean(value.postId || value.commentId), {
    message: "Choose something to report.",
  });

export const reportContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => reportSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await enforceRateLimit("communityReport", userId);

    const { error } = await supabase.from("community_reports").insert({
      reporter_id: userId,
      post_id: data.postId ?? null,
      comment_id: data.commentId ?? null,
      reason: data.reason,
      details: data.details ?? null,
      status: "PENDING",
    });
    if (error) throw toApiError(error);

    await recordAudit({
      userId,
      action: "COMMUNITY_REPORT_CREATED",
      entityType: data.postId ? "community_post" : "community_comment",
      entityId: data.postId ?? data.commentId ?? null,
      metadata: { reason: data.reason },
    });
    return { ok: true as const };
  });
