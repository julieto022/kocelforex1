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

export const searchCommunityMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        search: z
          .string()
          .trim()
          .max(30)
          .regex(/^[a-zA-Z0-9_ .-]*$/, "Search using a username."),
      })
      .parse(data ?? { search: "" }),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await enforceRateLimit("communitySearch", userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .neq("id", userId)
      .eq("status", "ACTIVE")
      .is("deleted_at", null)
      .not("username", "is", null)
      .order("username", { ascending: true })
      .limit(20);
    if (data.search.trim()) query = query.ilike("username", `%${data.search.trim()}%`);

    const { data: profiles, error } = await query;
    if (error) throw toApiError(error);
    const members = profiles ?? [];
    if (members.length === 0) return [];

    const memberIds = members.map((profile) => profile.id);
    const [{ data: followed, error: followError }, { data: blocks, error: blockError }] =
      await Promise.all([
        supabaseAdmin
          .from("community_follows")
          .select("following_id")
          .eq("follower_id", userId)
          .in("following_id", memberIds),
        supabaseAdmin
          .from("community_blocks")
          .select("blocker_id, blocked_id")
          .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
      ]);
    if (followError) throw toApiError(followError);
    if (blockError) throw toApiError(blockError);
    const followedIds = new Set((followed ?? []).map((row) => row.following_id));
    const blockedIds = new Set(
      (blocks ?? []).flatMap((row) =>
        row.blocker_id === userId ? [row.blocked_id] : [row.blocker_id],
      ),
    );
    return members
      .filter((member) => !blockedIds.has(member.id))
      .map((member) => ({ ...member, following: followedIds.has(member.id) }));
  });
