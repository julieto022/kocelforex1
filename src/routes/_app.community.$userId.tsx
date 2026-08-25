import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessagesSquare, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { PostCard } from "@/components/kocel/community-post";
import { PageHeader } from "@/components/kocel/page-header";
import { EmptyState, ErrorState, SectionCard } from "@/components/kocel/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import {
  blockUser,
  getAuthor,
  getFollowCounts,
  getPosts,
  isFollowing,
  toggleFollow,
} from "@/services/community";

export const Route = createFileRoute("/_app/community/$userId")({
  head: () => ({
    meta: [
      { title: "Trader profile — Kocel Forex Hub" },
      {
        name: "description",
        content: "View a Kocel trader's community posts, trade ideas and follower activity.",
      },
      { property: "og:title", content: "Trader profile — Kocel Forex Hub" },
      {
        property: "og:description",
        content: "Community posts and trade ideas shared by a Kocel trader.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityProfilePage,
});

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

function CommunityProfilePage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const authorQuery = useQuery({
    queryKey: ["community-author", userId],
    queryFn: () => getAuthor(userId),
  });

  const countsQuery = useQuery({
    queryKey: ["community-follow-counts", userId],
    queryFn: () => getFollowCounts(userId),
  });

  const followingQuery = useQuery({
    queryKey: ["community-following", user?.id, userId],
    queryFn: () => isFollowing(user!.id, userId),
    enabled: Boolean(user?.id) && user?.id !== userId,
  });

  const postsKey = ["community-posts", { userId, viewer: user?.id ?? null }];

  const postsQuery = useQuery({
    queryKey: postsKey,
    queryFn: () => getPosts({ userId }, user?.id ?? null),
  });

  const followMutation = useMutation({
    mutationFn: () => toggleFollow(user!.id, userId, Boolean(followingQuery.data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-following"] });
      queryClient.invalidateQueries({ queryKey: ["community-follow-counts", userId] });
    },
    onError: () => toast.error("Could not update follow state."),
  });

  const blockMutation = useMutation({
    mutationFn: () => blockUser(user!.id, userId),
    onSuccess: () => toast.success("Trader blocked. You won't be shown their activity."),
    onError: () => toast.error("Could not block this trader."),
  });

  const author = authorQuery.data;
  const name = author?.full_name ?? author?.username ?? "Kocel trader";
  const isSelf = user?.id === userId;
  const posts = postsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trader profile"
        description="Community activity shared by this trader."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/community">
              <ArrowLeft className="mr-1.5 size-4" />
              Back to feed
            </Link>
          </Button>
        }
      />

      <SectionCard>
        {authorQuery.isLoading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="size-12">
              {author?.avatar_url && <AvatarImage src={author.avatar_url} alt={name} />}
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-foreground">{name}</h2>
              {author?.username && (
                <p className="text-xs text-muted-foreground">@{author.username}</p>
              )}
              <p className="num mt-1 text-xs text-muted-foreground">
                {countsQuery.data?.followers ?? 0} followers ·{" "}
                {countsQuery.data?.following ?? 0} following · {posts.length} posts
              </p>
            </div>
            {!isSelf && user && (
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant={followingQuery.data ? "outline" : "default"}
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isPending}
                >
                  {followingQuery.data ? "Unfollow" : "Follow"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => blockMutation.mutate()}
                  disabled={blockMutation.isPending}
                >
                  <ShieldOff className="mr-1.5 size-4" />
                  Block
                </Button>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {postsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="panel space-y-3 p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : postsQuery.isError ? (
        <SectionCard title="Posts">
          <ErrorState
            title="Posts could not be loaded"
            description="We couldn't reach the community store. Try again in a moment."
            onRetry={() => postsQuery.refetch()}
          />
        </SectionCard>
      ) : posts.length === 0 ? (
        <SectionCard title="Posts">
          <EmptyState
            icon={MessagesSquare}
            title="No posts yet"
            description="This trader hasn't shared anything with the community."
          />
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              invalidateKey={postsKey}
              showAuthorLink={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
