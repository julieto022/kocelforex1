import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PostCard } from "@/components/kocel/community-post";
import { PageHeader } from "@/components/kocel/page-header";
import { EmptyState, ErrorState, SectionCard } from "@/components/kocel/states";
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
import { createPost, getPosts } from "@/services/community";
import { COMMUNITY_CATEGORIES } from "@/services/types";

export const Route = createFileRoute("/_app/community/")({
  head: () => ({
    meta: [
      { title: "Community — Kocel Forex Hub" },
      {
        name: "description",
        content:
          "Share trade ideas, discuss market moves and follow other Kocel traders in the community feed.",
      },
      { property: "og:title", content: "Community — Kocel Forex Hub" },
      {
        property: "og:description",
        content: "Trade ideas, market discussion and analysis shared by Kocel traders.",
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

  const [draftCategory, setDraftCategory] = useState("general");
  const [draftSymbol, setDraftSymbol] = useState("none");
  const [content, setContent] = useState("");

  const feedKey = ["community-posts", { category, symbol, sort, search, viewer: user?.id ?? null }];

  const postsQuery = useQuery({
    queryKey: feedKey,
    queryFn: () => getPosts({ category, symbol, sort, search }, user?.id ?? null),
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

  const posts = postsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Community"
        description="Discuss the market, share trade ideas and follow other Kocel traders."
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
