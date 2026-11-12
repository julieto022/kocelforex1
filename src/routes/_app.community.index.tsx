import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PostCard } from "@/components/kocel/community-post";
import { PageHeader } from "@/components/kocel/page-header";
import { EmptyState, ErrorState, SectionCard } from "@/components/kocel/states";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { createPost, getPosts, searchMembers, toggleFollow } from "@/services/community";
import { COMMUNITY_CATEGORIES } from "@/services/types";

export const Route = createFileRoute("/_app/community/")({
  head: () => ({
    meta: [
      { title: "Community — Kocel Forex Hub" },
      {
        name: "description",
        content: "Share trade ideas, discuss market moves and follow community members.",
      },
      { property: "og:title", content: "Community — Kocel Forex Hub" },
      {
        property: "og:description",
        content: "Trade ideas, market discussion and analysis shared by community members.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommunityPage,
});

const SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30"];

function CommunityPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState("all");
  const [symbol, setSymbol] = useState("all");
  const [sort, setSort] = useState("latest");
  const [search, setSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const [draftCategory, setDraftCategory] = useState("general");
  const [draftSymbol, setDraftSymbol] = useState("none");
  const [content, setContent] = useState("");

  const feedKey = ["community-posts", { category, symbol, sort, search, viewer: user?.id ?? null }];

  const postsQuery = useQuery({
    queryKey: feedKey,
    queryFn: () => getPosts({ category, symbol, sort, search }, user?.id ?? null),
  });
  const membersQuery = useQuery({
    queryKey: ["community-members", user?.id, memberSearch],
    queryFn: () => searchMembers(memberSearch),
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createPost(user!.id, {
        category: draftCategory,
        content: content.trim(),
        symbol: draftSymbol === "none" ? undefined : draftSymbol,
      }),
    onSuccess: () => {
      setContent("");
      toast.success("Posted to the community.");
      queryClient.invalidateQueries({ queryKey: ["community-posts"] });
    },
    onError: () => toast.error("Could not publish your post."),
  });
  const followMutation = useMutation({
    mutationFn: (input: { memberId: string; following: boolean }) =>
      toggleFollow(user!.id, input.memberId, input.following),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["community-members", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["community-follow-counts"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Could not update follow state."),
  });

  const posts = postsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Community"
        description="Discuss the market, share trade ideas and follow community members."
      />

      {user && (
        <SectionCard title="Share something">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!content.trim()) return;
              createMutation.mutate();
            }}
          >
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="What are you seeing in the market?"
              rows={3}
              maxLength={2000}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Select value={draftCategory} onValueChange={setDraftCategory}>
                <SelectTrigger className="h-8 w-44">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNITY_CATEGORIES.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={draftSymbol} onValueChange={setDraftSymbol}>
                <SelectTrigger className="h-8 w-32">
                  <SelectValue placeholder="Symbol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No symbol</SelectItem>
                  {SYMBOLS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                type="submit"
                className="ml-auto"
                disabled={createMutation.isPending || !content.trim()}
              >
                Post
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      {user && (
        <SectionCard
          title="Find members"
          description="Discover people by username, follow their market discussions, and visit their profiles."
          action={<Users className="size-4 text-muted-foreground" />}
        >
          <div className="space-y-3">
            <Input
              aria-label="Search community usernames"
              placeholder="Search usernames"
              value={memberSearch}
              maxLength={30}
              onChange={(event) => setMemberSearch(event.target.value)}
            />
            {membersQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Finding community members…</p>
            ) : membersQuery.isError ? (
              <p className="text-sm text-destructive" role="alert">
                Community members could not be loaded.
              </p>
            ) : (membersQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No members found. Try a shorter username search.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(membersQuery.data ?? []).map((member) => (
                  <li
                    key={member.id}
                    className="flex min-w-0 items-center gap-2 rounded-md border border-border p-2.5"
                  >
                    <Avatar className="size-9">
                      {member.avatar_url && (
                        <AvatarImage src={member.avatar_url} alt={`@${member.username}`} />
                      )}
                      <AvatarFallback>{(member.username?.[0] ?? "U").toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/community/$userId"
                        params={{ userId: member.id }}
                        className="block truncate text-sm font-medium text-foreground hover:text-primary"
                      >
                        @{member.username}
                      </Link>
                    </div>
                    <Button
                      size="sm"
                      variant={member.following ? "outline" : "default"}
                      disabled={followMutation.isPending}
                      onClick={() =>
                        followMutation.mutate({
                          memberId: member.id,
                          following: member.following,
                        })
                      }
                    >
                      {member.following ? "Following" : "Follow"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {COMMUNITY_CATEGORIES.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue placeholder="Symbol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All symbols</SelectItem>
              {SYMBOLS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="popular">Popular</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="h-8 w-44 sm:ml-auto"
            placeholder="Search posts"
            value={search}
            maxLength={80}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </SectionCard>

      {postsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="panel space-y-3 p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : postsQuery.isError ? (
        <SectionCard title="Feed">
          <ErrorState
            title="The feed could not be loaded"
            description="We couldn't reach the community store. Try again in a moment."
            onRetry={() => postsQuery.refetch()}
          />
        </SectionCard>
      ) : posts.length === 0 ? (
        <SectionCard title="Feed">
          <EmptyState
            icon={MessagesSquare}
            title="No posts yet"
            description="Be the first to share a market view or trade idea with the Kocel community."
          />
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} invalidateKey={feedKey} />
          ))}
        </div>
      )}
    </div>
  );
}
