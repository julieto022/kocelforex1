import { supabase } from "@/integrations/supabase/client";
import type {
  CommunityAuthor,
  CommunityComment,
  CommunityPost,
  TradingIdea,
} from "./types";

export type CommunityFilters = {
  category?: string | undefined;
  symbol?: string | undefined;
  search?: string | undefined;
  userId?: string | undefined;
  /** latest | popular */
  sort?: string | undefined;
};

async function loadAuthors(userIds: string[]): Promise<Map<string, CommunityAuthor>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", unique);
  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [row.id, row as unknown as CommunityAuthor] as const),
  );
}

async function decoratePosts(
  rows: Record<string, unknown>[],
  viewerId: string | null,
): Promise<CommunityPost[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row["id"] as string);
  const authors = await loadAuthors(rows.map((row) => row["user_id"] as string));

  const [{ data: reactions, error: reactionError }, { data: comments, error: commentError }] =
    await Promise.all([
      supabase.from("community_reactions").select("post_id, user_id").in("post_id", ids),
      supabase.from("community_comments").select("post_id").in("post_id", ids),
    ]);
  if (reactionError) throw reactionError;
  if (commentError) throw commentError;

  return rows.map((row) => {
    const id = row["id"] as string;
    const postReactions = (reactions ?? []).filter((item) => item.post_id === id);
    return {
      ...(row as unknown as CommunityPost),
      idea: (row["idea"] as TradingIdea | null) ?? null,
      author: authors.get(row["user_id"] as string) ?? null,
      reaction_count: postReactions.length,
      comment_count: (comments ?? []).filter((item) => item.post_id === id).length,
      reacted: viewerId ? postReactions.some((item) => item.user_id === viewerId) : false,
    };
  });
}

export async function getPosts(
  filters: CommunityFilters = {},
  viewerId: string | null = null,
): Promise<CommunityPost[]> {
  let query = supabase.from("community_posts").select("*");
  if (filters.category && filters.category !== "all") query = query.eq("category", filters.category);
  if (filters.symbol && filters.symbol !== "all") query = query.eq("symbol", filters.symbol);
  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.search?.trim()) query = query.ilike("content", `%${filters.search.trim()}%`);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
  if (error) throw error;

  const posts = await decoratePosts((data ?? []) as unknown as Record<string, unknown>[], viewerId);
  if (filters.sort === "popular") {
    return [...posts].sort(
      (a, b) =>
        (b.reaction_count ?? 0) + (b.comment_count ?? 0) -
        ((a.reaction_count ?? 0) + (a.comment_count ?? 0)),
    );
  }
  return posts;
}

export async function getPost(
  postId: string,
  viewerId: string | null = null,
): Promise<CommunityPost | null> {
  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [post] = await decoratePosts([data as unknown as Record<string, unknown>], viewerId);
  return post ?? null;
}

export async function createPost(
  userId: string,
  input: {
    category: string;
    content: string;
    symbol?: string | undefined;
    image_url?: string | undefined;
    idea?: TradingIdea | undefined;
  },
) {
  const { error } = await supabase.from("community_posts").insert({
    user_id: userId,
    category: input.category,
    content: input.content,
    symbol: input.symbol ?? null,
    image_url: input.image_url ?? null,
    idea: (input.idea ?? null) as never,
  });
  if (error) throw error;
}

export async function deletePost(postId: string) {
  const { error } = await supabase.from("community_posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function getComments(postId: string): Promise<CommunityComment[]> {
  const { data, error } = await supabase
    .from("community_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as CommunityComment[];
  const authors = await loadAuthors(rows.map((row) => row.user_id));
  return rows.map((row) => ({ ...row, author: authors.get(row.user_id) ?? null }));
}

export async function addComment(
  userId: string,
  input: { postId: string; content: string; parentId?: string | undefined },
) {
  const { error } = await supabase.from("community_comments").insert({
    user_id: userId,
    post_id: input.postId,
    content: input.content,
    parent_id: input.parentId ?? null,
  });
  if (error) throw error;
}

export async function toggleReaction(userId: string, postId: string, reacted: boolean) {
  if (reacted) {
    const { error } = await supabase
      .from("community_reactions")
      .delete()
      .eq("user_id", userId)
      .eq("post_id", postId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("community_reactions")
    .insert({ user_id: userId, post_id: postId, reaction: "like" });
  if (error) throw error;
}

export async function reportContent(
  reporterId: string,
  input: {
    reason: string;
    details?: string | undefined;
    postId?: string | undefined;
    commentId?: string | undefined;
  },
) {
  const { error } = await supabase.from("community_reports").insert({
    reporter_id: reporterId,
    reason: input.reason,
    details: input.details ?? null,
    post_id: input.postId ?? null,
    comment_id: input.commentId ?? null,
  });
  if (error) throw error;
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("community_follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function toggleFollow(followerId: string, followingId: string, following: boolean) {
  if (following) {
    const { error } = await supabase
      .from("community_follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("community_follows")
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
}

export async function getFollowCounts(userId: string) {
  const [followers, following] = await Promise.all([
    supabase
      .from("community_follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", userId),
    supabase
      .from("community_follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);
  if (followers.error) throw followers.error;
  if (following.error) throw following.error;
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("community_blocks")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}

export async function getAuthor(userId: string): Promise<CommunityAuthor | null> {
  const authors = await loadAuthors([userId]);
  return authors.get(userId) ?? null;
}

/** Recent community activity for the dashboard widget. */
export async function getRecentActivity(limit = 5, viewerId: string | null = null) {
  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return decoratePosts((data ?? []) as unknown as Record<string, unknown>[], viewerId);
}
