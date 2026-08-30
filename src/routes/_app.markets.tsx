import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { PageHeader } from "@/components/kocel/page-header";
import { SectionCard } from "@/components/kocel/states";
import { StatusBadge } from "@/components/kocel/status-badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConnections } from "@/lib/use-connections";
import {
  MARKET_CATEGORIES,
  REFERENCE_INSTRUMENTS,
  getQuotes,
  type MarketCategory,
} from "@/services/markets";

export const Route = createFileRoute("/_app/markets")({
  component: MarketsPage,
});

function MarketsPage() {
  const { active } = useConnections();
  const [category, setCategory] = useState<MarketCategory>("forex");
  const [search, setSearch] = useState("");

  const quotesQuery = useQuery({
    queryKey: ["quotes", active?.id ?? null],
    queryFn: () => getQuotes(active),
  });

  const instruments = REFERENCE_INSTRUMENTS.filter(
    (instrument) =>
      instrument.category === category &&
      instrument.symbol.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Markets"
        description="Reference symbol list. Live prices require a connected MT5 terminal — no broker supports every symbol."
      />

      <SectionCard
        title="Market watch"
        action={
          <StatusBadge tone={quotesQuery.data?.available ? "success" : "warning"} size="sm">
            {quotesQuery.data?.available ? "Live" : "Awaiting Bridge EA"}
          </StatusBadge>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={category} onValueChange={(value) => setCategory(value as MarketCategory)}>
            <TabsList>
              {MARKET_CATEGORIES.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Input
            className="h-8 w-40"
            placeholder="Search symbol"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={20}
          />
        </div>

        <ul className="mt-4 divide-y divide-border rounded-md border border-border">
          {instruments.map((instrument) => (
            <li
              key={instrument.symbol}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="num font-medium text-foreground">{instrument.symbol}</p>
                <p className="truncate text-xs text-muted-foreground">{instrument.name}</p>
              </div>
              <span className="num text-sm text-muted-foreground">— / —</span>
            </li>
          ))}
          {instruments.length === 0 && (
            <li className="px-3 py-4 text-sm text-muted-foreground">
              No symbols match your search.
            </li>
          )}
        </ul>
      </SectionCard>
    </div>
  );
}
