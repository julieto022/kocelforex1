import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, Newspaper } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/kocel/page-header";
import { EmptyState, ErrorState, SectionCard } from "@/components/kocel/states";
import { StatusBadge } from "@/components/kocel/status-badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getNews } from "@/services/news";
import { getEconomicEvents } from "@/services/economic-calendar";
import {
  IMPACT_MODEL,
  NEWS_CATEGORIES,
  NEWS_CURRENCIES,
  type ImpactLevel,
} from "@/services/types";

export const Route = createFileRoute("/_app/news")({
  component: NewsPage,
});

const RANGES = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "This week" },
];

function impactBadge(impact: string) {
  const model = IMPACT_MODEL[impact as ImpactLevel];
  return (
    <StatusBadge tone={model?.tone ?? "neutral"} size="sm">
      {model?.label ?? impact}
    </StatusBadge>
  );
}

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function NewsPage() {
  const [tab, setTab] = useState("news");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [impact, setImpact] = useState("all");
  const [range, setRange] = useState("all");

  const newsQuery = useQuery({
    queryKey: ["news", { search, category, currency, impact, range }],
    queryFn: () => getNews({ search, category, currency, impact, range }),
  });

  const eventsQuery = useQuery({
    queryKey: ["economic-events", { currency, impact, range }],
    queryFn: () => getEconomicEvents({ currency, impact, range }),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="News & Economic Calendar"
        description="Market news and scheduled economic releases. Kocel only displays data from connected providers — nothing is generated."
      />

      <SectionCard>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="news">News</TabsTrigger>
              <TabsTrigger value="calendar">Economic calendar</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {tab === "news" && (
              <Input
                className="h-8 w-40"
                placeholder="Search headlines"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={80}
              />
            )}
            {tab === "news" && (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {NEWS_CATEGORIES.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All currencies</SelectItem>
                {NEWS_CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={impact} onValueChange={setImpact}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue placeholder="Impact" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All impact</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      {tab === "news" ? (
        <SectionCard title="Latest news" bodyClassName="p-0 sm:p-0">
          {newsQuery.isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : newsQuery.isError ? (
            <ErrorState
              title="News could not be loaded"
              description="We couldn't reach the news store. Try again in a moment."
              onRetry={() => newsQuery.refetch()}
            />
          ) : (newsQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="No news available"
              description="No articles match these filters yet. News appears here as soon as a news provider is connected and publishing."
            />
          ) : (
            <ul className="divide-y divide-border">
              {(newsQuery.data ?? []).map((item) => (
                <li key={item.id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {impactBadge(String(item.impact))}
                    {item.currency && (
                      <StatusBadge tone="info" size="sm" dot={false}>
                        {item.currency}
                      </StatusBadge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {item.source ?? "Unknown source"} · {formatTime(item.published_at)}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-semibold text-foreground">{item.title}</h3>
                  {item.summary && (
                    <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
                    >
                      Read source <ExternalLink className="size-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : (
        <SectionCard title="Economic calendar" bodyClassName="p-0 sm:p-0">
          {eventsQuery.isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : eventsQuery.isError ? (
            <ErrorState
              title="Calendar could not be loaded"
              onRetry={() => eventsQuery.refetch()}
            />
          ) : (eventsQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No scheduled events"
              description="Economic releases appear here once an economic-data provider is connected."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Time</th>
                    <th className="px-4 py-2 text-left font-medium">Currency</th>
                    <th className="px-4 py-2 text-left font-medium">Event</th>
                    <th className="px-4 py-2 text-left font-medium">Impact</th>
                    <th className="px-4 py-2 text-right font-medium">Previous</th>
                    <th className="px-4 py-2 text-right font-medium">Forecast</th>
                    <th className="px-4 py-2 text-right font-medium">Actual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(eventsQuery.data ?? []).map((event) => (
                    <tr key={event.id}>
                      <td className="num whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                        {formatTime(event.event_time)}
                      </td>
                      <td className="num px-4 py-2.5 font-medium">{event.currency}</td>
                      <td className="px-4 py-2.5">{event.event_name}</td>
                      <td className="px-4 py-2.5">{impactBadge(String(event.impact))}</td>
                      <td className="num px-4 py-2.5 text-right">{event.previous ?? "—"}</td>
                      <td className="num px-4 py-2.5 text-right">{event.forecast ?? "—"}</td>
                      <td className="num px-4 py-2.5 text-right font-medium">
                        {event.actual ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
