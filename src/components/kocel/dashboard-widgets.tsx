import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  MessagesSquare,
  Newspaper,
  Target,
  TrendingUp,
} from "lucide-react";

import { SectionCard } from "@/components/kocel/states";
import { StatusBadge } from "@/components/kocel/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { getRecentActivity } from "@/services/community";
import { getUpcomingEvents } from "@/services/economic-calendar";
import { countdownTo, getUpcomingNfpPrediction } from "@/services/nfp";
import { getLatestNews } from "@/services/news";
import { getActiveSignals, signalTone } from "@/services/signals";
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

export function DashboardWidgets() {
  const { user } = useAuth();

  const newsQuery = useQuery({ queryKey: ["dash-news"], queryFn: () => getLatestNews(4) });
  const eventsQuery = useQuery({ queryKey: ["dash-events"], queryFn: () => getUpcomingEvents(4) });
  const nfpQuery = useQuery({ queryKey: ["dash-nfp"], queryFn: getUpcomingNfpPrediction });
  const signalsQuery = useQuery({
    queryKey: ["dash-signals"],
    queryFn: () => getActiveSignals(4),
  });
  const activityQuery = useQuery({
    queryKey: ["dash-community", user?.id ?? null],
    queryFn: () => getRecentActivity(4, user?.id ?? null),
  });

  const countdown = countdownTo(nfpQuery.data?.release_date);

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
        ) : (newsQuery.data ?? []).length === 0 ? (
          <Empty text="No news yet — headlines appear once a news provider is connected." />
        ) : (
          <ul className="space-y-2.5">
            {(newsQuery.data ?? []).map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <Newspaper className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{item.title}</p>
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
        ) : (eventsQuery.data ?? []).length === 0 ? (
          <Empty text="No scheduled events available yet." />
        ) : (
          <ul className="space-y-2.5">
            {(eventsQuery.data ?? []).map((event) => (
              <li key={event.id} className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {event.event_name}
                  </p>
                  <p className="num text-[0.65rem] text-muted-foreground">
                    {event.currency} · {shortTime(event.event_time)}
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
        ) : !nfpQuery.data ? (
          <Empty text="No upcoming NFP release published yet." />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <p className="num text-lg font-semibold text-foreground">
                {countdown
                  ? countdown.past
                    ? "Released"
                    : `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m`
                  : "—"}
              </p>
            </div>
            <p className="num text-xs text-muted-foreground">
              Release {shortTime(nfpQuery.data.release_date)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge tone="neutral" size="sm" dot={false}>
                Forecast {nfpQuery.data.forecast ?? "—"}
              </StatusBadge>
              <StatusBadge tone="neutral" size="sm" dot={false}>
                Previous {nfpQuery.data.previous ?? "—"}
              </StatusBadge>
              {nfpQuery.data.confidence != null && (
                <StatusBadge tone="info" size="sm" dot={false}>
                  {Number(nfpQuery.data.confidence).toFixed(0)}% confidence
                </StatusBadge>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Active signals"
        action={
          <Link to="/signal-prediction" className="text-xs font-medium text-primary">
            View all
          </Link>
        }
      >
        {signalsQuery.isLoading ? (
          <WidgetSkeleton />
        ) : (signalsQuery.data ?? []).length === 0 ? (
          <Empty text="No active signals published right now." />
        ) : (
          <ul className="space-y-2.5">
            {(signalsQuery.data ?? []).map((signal) => (
              <li key={signal.id} className="flex items-center gap-2">
                <Target className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="num text-xs font-medium text-foreground">{signal.symbol}</span>
                <span className="text-[0.65rem] text-muted-foreground">
                  {signal.timeframe ?? "—"}
                </span>
                <StatusBadge
                  tone={signalTone(String(signal.direction))}
                  size="sm"
                  className="ml-auto"
                >
                  {signal.direction}
                </StatusBadge>
                <span className="num text-[0.65rem] text-muted-foreground">
                  {signal.confidence == null
                    ? "—"
                    : `${Number(signal.confidence).toFixed(0)}%`}
                </span>
              </li>
            ))}
          </ul>
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
                    {post.author?.full_name ?? post.author?.username ?? "Kocel trader"} ·{" "}
                    {post.reaction_count ?? 0} likes · {post.comment_count ?? 0} comments
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
