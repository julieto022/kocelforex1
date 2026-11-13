import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Clock3, MessagesSquare, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";

import { SectionCard } from "@/components/kocel/states";
import { StatusBadge } from "@/components/kocel/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getMarketCalendarFeed,
  getMarketNewsFeed,
  getNfpCountdown,
} from "@/lib/functions/market-intelligence.functions";
import { useAuth } from "@/lib/auth";
import { getRecentActivity } from "@/services/community";
import { IMPACT_MODEL, type ImpactLevel } from "@/services/types";

function impactTone(impact: string) {
  return IMPACT_MODEL[impact as ImpactLevel]?.tone ?? "neutral";
}

function shortTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function WidgetSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3.5 w-3/5" />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

function NfpCountdownBoard({
  releaseAt,
  estimated,
  source,
}: {
  releaseAt: string;
  estimated: boolean;
  source: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const releaseTimestamp = Date.parse(releaseAt);
  if (!Number.isFinite(releaseTimestamp)) return <Empty text="Release time unavailable." />;
  const remaining = Math.max(0, Math.floor((releaseTimestamp - now) / 1_000));
  const units = [
    { label: "Days", value: Math.floor(remaining / 86_400) },
    { label: "Hours", value: Math.floor((remaining % 86_400) / 3_600) },
    { label: "Minutes", value: Math.floor((remaining % 3_600) / 60) },
    { label: "Seconds", value: remaining % 60 },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5">
        {units.map((unit) => (
          <div
            key={unit.label}
            className="rounded-md border border-border bg-muted/40 px-1.5 py-2 text-center"
          >
            <p className="num text-lg font-semibold tabular-nums text-foreground">
              {String(unit.value).padStart(2, "0")}
            </p>
            <p className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
              {unit.label}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2">
        <Clock3 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">
            {new Date(releaseAt).toLocaleString(undefined, {
              weekday: "short",
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "America/New_York",
              timeZoneName: "short",
            })}
          </p>
          <p className="text-[0.65rem] text-muted-foreground">
            {estimated ? "Estimated schedule · " : ""}
            {source} · New York time
          </p>
        </div>
      </div>
    </div>
  );
}

export function DashboardWidgets() {
  const { user } = useAuth();

  const newsQuery = useQuery({
    queryKey: ["dash-news"],
    queryFn: () => getMarketNewsFeed({ data: { range: "all" } }),
    staleTime: 5 * 60_000,
  });
  const eventsQuery = useQuery({
    queryKey: ["dash-events"],
    queryFn: () => getMarketCalendarFeed({ data: { limit: 4 } }),
    staleTime: 5 * 60_000,
  });
  const nfpQuery = useQuery({
    queryKey: ["dash-nfp"],
    queryFn: () => getNfpCountdown(),
    staleTime: 15 * 60_000,
  });
  const activityQuery = useQuery({
    queryKey: ["dash-community", user?.id ?? null],
    queryFn: () => getRecentActivity(4, user?.id ?? null),
  });

  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <SectionCard
        title="Latest news"
        action={
          <Link to="/news" className="text-xs font-medium text-primary">
            View all
          </Link>
        }
      >
        {newsQuery.isLoading ? (
          <WidgetSkeleton />
        ) : newsQuery.isError ? (
          <Empty text="Live market-news sources are temporarily unavailable." />
        ) : (newsQuery.data?.items ?? []).length === 0 ? (
          <Empty text="No news yet — headlines appear once a news provider is connected." />
        ) : (
          <ul className="space-y-2.5">
            {(newsQuery.data?.items ?? []).slice(0, 4).map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <Newspaper className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  {item.url ? (
                    <a
                      className="line-clamp-2 text-xs font-medium text-foreground hover:text-primary"
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <p className="line-clamp-2 text-xs font-medium text-foreground">{item.title}</p>
                  )}
                  <p className="num text-[0.65rem] text-muted-foreground">
                    {item.source ?? "Unknown"} · {shortTime(item.published_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Upcoming events"
        action={
          <Link to="/news" className="text-xs font-medium text-primary">
            Calendar
          </Link>
        }
      >
        {eventsQuery.isLoading ? (
          <WidgetSkeleton />
        ) : eventsQuery.isError ? (
          <Empty text="The live economic calendar is temporarily unavailable." />
        ) : (eventsQuery.data?.items ?? []).length === 0 ? (
          <Empty text="No scheduled events available yet." />
        ) : (
          <ul className="space-y-2.5">
            {(eventsQuery.data?.items ?? []).slice(0, 4).map((event) => (
              <li key={event.id} className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{event.event_name}</p>
                  <p className="num text-[0.65rem] text-muted-foreground">
                    {event.currency} · {shortTime(event.event_time)} · {event.source}
                  </p>
                </div>
                <StatusBadge tone={impactTone(String(event.impact))} size="sm" dot={false}>
                  {String(event.impact)}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="NFP countdown"
        action={
          <Link to="/nfp-prediction" className="text-xs font-medium text-primary">
            Details
          </Link>
        }
      >
        {nfpQuery.isLoading ? (
          <WidgetSkeleton />
        ) : nfpQuery.isError ? (
          <Empty text="Could not load the next NFP release schedule." />
        ) : !nfpQuery.data ? (
          <Empty text="Upcoming NFP release schedule is unavailable." />
        ) : (
          <NfpCountdownBoard
            releaseAt={nfpQuery.data.releaseAt}
            estimated={nfpQuery.data.isEstimated}
            source={nfpQuery.data.source}
          />
        )}
      </SectionCard>

      <SectionCard
        title="Community activity"
        className="lg:col-span-2 xl:col-span-2"
        action={
          <Link to="/community" className="text-xs font-medium text-primary">
            Open community
          </Link>
        }
      >
        {activityQuery.isLoading ? (
          <WidgetSkeleton />
        ) : (activityQuery.data ?? []).length === 0 ? (
          <Empty text="No community posts yet — share the first market view." />
        ) : (
          <ul className="space-y-2.5">
            {(activityQuery.data ?? []).map((post) => (
              <li key={post.id} className="flex items-start gap-2">
                <MessagesSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-foreground">{post.content}</p>
                  <p className="text-[0.65rem] text-muted-foreground">
                    {post.author?.username ? (
                      <Link
                        to="/community/$userId"
                        params={{ userId: post.user_id }}
                        className="hover:text-primary"
                      >
                        @{post.author.username}
                      </Link>
                    ) : (
                      "Username unavailable"
                    )}{" "}
                    · {post.reaction_count ?? 0} likes · {post.comment_count ?? 0} comments
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
