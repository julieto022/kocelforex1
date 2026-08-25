import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Flag, Heart, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/kocel/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  addComment,
  deletePost,
  getComments,
  reportContent,
  toggleReaction,
} from "@/services/community";
import { COMMUNITY_CATEGORIES, REPORT_REASONS, type CommunityPost } from "@/services/types";

function categoryLabel(category: string) {
  return COMMUNITY_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

function initials(name: string | null | undefined) {
  if (!name) return "K";
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function PostCard({
  post,
  invalidateKey,
  showAuthorLink = true,
}: {
  post: CommunityPost;
  invalidateKey: unknown[];
  showAuthorLink?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: invalidateKey });

  const commentsQuery = useQuery({
    queryKey: ["community-comments", post.id],
    queryFn: () => getComments(post.id),
    enabled: showComments,
  });

  const reactionMutation = useMutation({
    mutationFn: () => toggleReaction(user!.id, post.id, Boolean(post.reacted)),
    onSuccess: invalidate,
    onError: () => toast.error("Could not update your reaction."),
  });

  const commentMutation = useMutation({
    mutationFn: () => addComment(user!.id, { postId: post.id, content: comment.trim() }),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["community-comments", post.id] });
      invalidate();
    },
    onError: () => toast.error("Could not post your comment."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      toast.success("Post deleted.");
      invalidate();
    },
    onError: () => toast.error("Could not delete this post."),
  });

  const reportMutation = useMutation({
    mutationFn: () => reportContent(user!.id, { reason, postId: post.id }),
    onSuccess: () => {
      setReportOpen(false);
      toast.success("Thanks — this post has been reported.");
    },
    onError: () => toast.error("Could not submit the report."),
  });

  const name = post.author?.full_name ?? post.author?.username ?? "Kocel trader";
  const isOwner = user?.id === post.user_id;

  return (
    <article className="panel p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <Avatar className="size-9">
          {post.author?.avatar_url && <AvatarImage src={post.author.avatar_url} alt={name} />}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {showAuthorLink ? (
              <Link
                to="/community/$userId"
                params={{ userId: post.user_id }}
                className="truncate text-sm font-semibold text-foreground hover:text-primary"
              >
                {name}
              </Link>
            ) : (
              <span className="truncate text-sm font-semibold text-foreground">{name}</span>
            )}
            <StatusBadge tone="info" size="sm" dot={false}>
              {categoryLabel(String(post.category))}
            </StatusBadge>
            {post.symbol && (
              <StatusBadge tone="neutral" size="sm" dot={false}>
                {post.symbol}
              </StatusBadge>
            )}
          </div>
          <p className="num text-xs text-muted-foreground">{formatTime(post.created_at)}</p>
        </div>
        {isOwner && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete post"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </header>

      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{post.content}</p>

      {post.image_url && (
        <img
          src={post.image_url}
          alt={`Chart shared by ${name}`}
          loading="lazy"
          className="mt-3 w-full rounded-md border border-border object-cover"
        />
      )}

      {post.idea && (
        <div className="mt-3 grid gap-2 rounded-md border border-border bg-muted/40 p-3 sm:grid-cols-3">
          {[
            { label: "Direction", value: post.idea.direction },
            { label: "Timeframe", value: post.idea.timeframe },
            { label: "Entry", value: post.idea.entry },
            { label: "Stop loss", value: post.idea.stop_loss },
            { label: "Take profit", value: post.idea.take_profit },
            { label: "Risk / reward", value: post.idea.risk_reward },
          ]
            .filter((item) => item.value)
            .map((item) => (
              <div key={item.label}>
                <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="num text-sm font-medium text-foreground">{item.value}</p>
              </div>
            ))}
        </div>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => reactionMutation.mutate()}
          disabled={!user || reactionMutation.isPending}
        >
          <Heart className={cn("mr-1.5 size-4", post.reacted && "fill-primary text-primary")} />
          {post.reaction_count ?? 0}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowComments((open) => !open)}>
          <MessageSquare className="mr-1.5 size-4" />
          {post.comment_count ?? 0}
        </Button>
        {!isOwner && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            onClick={() => setReportOpen((open) => !open)}
          >
            <Flag className="mr-1.5 size-4" />
            Report
          </Button>
        )}
      </footer>

      {reportOpen && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
          <Select value={reason} onValueChange={(value) => setReason(value as typeof reason)}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="Reason" />
            </SelectTrigger>
            <SelectContent>
              {REPORT_REASONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => reportMutation.mutate()}
            disabled={!user || reportMutation.isPending}
          >
            Submit report
          </Button>
        </div>
      )}

      {showComments && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {commentsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading comments…</p>
          ) : (commentsQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {(commentsQuery.data ?? []).map((item) => (
                <li key={item.id} className="flex gap-2.5">
                  <Avatar className="size-7">
                    {item.author?.avatar_url && (
                      <AvatarImage src={item.author.avatar_url} alt="" />
                    )}
                    <AvatarFallback className="text-[0.6rem]">
                      {initials(item.author?.full_name ?? item.author?.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {item.author?.full_name ?? item.author?.username ?? "Kocel trader"}
                    </p>
                    <p className="text-sm text-muted-foreground">{item.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {user && (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!comment.trim()) return;
                commentMutation.mutate();
              }}
            >
              <Input
                className="h-9"
                placeholder="Write a comment"
                value={comment}
                maxLength={500}
                onChange={(event) => setComment(event.target.value)}
              />
              <Button size="sm" type="submit" disabled={commentMutation.isPending}>
                Reply
              </Button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
