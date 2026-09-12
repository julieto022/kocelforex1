import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, LineChart, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/kocel/page-header";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/kocel/states";
import { StatusBadge } from "@/components/kocel/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getStrategies, StrategyServiceError } from "@/services/strategies";
import type { Strategy } from "@/services/types";

export const Route = createFileRoute("/_app/strategies")({
  component: StrategiesPage,
});

const categoryOptions = [
  "All",
  "Scalping",
  "Day Trading",
  "Swing Trading",
  "Position Trading",
  "Trend Following",
  "Range Trading",
  "Breakout",
  "Price Action",
  "NFP News Trading",
  "Carry",
  "Grid",
  "Algorithmic / HFT",
];

const configurationLabels: Record<string, string> = {
  timeframes: "Supported timeframes",
  indicators: "Indicators",
  entry_conditions: "Entry conditions",
  exit_conditions: "Exit conditions",
  filters: "Filters",
  risk_parameters: "Risk parameters",
};

function formatConfigurationValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ") || "None listed";
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "None listed");
}

function strategyErrorCode(error: unknown) {
  return error instanceof StrategyServiceError ? error.code : "UNKNOWN_ERROR";
}

function strategyErrorDescription(error: unknown) {
  switch (strategyErrorCode(error)) {
    case "AUTH_REQUIRED":
      return "Sign in to view the Kocel strategy library.";
    case "TABLE_NOT_FOUND":
      return "The strategy table is not available in the configured Supabase project.";
    case "COLUMN_NOT_FOUND":
      return "The strategy database schema is incomplete. Apply the strategy library migration.";
    case "RLS_DENIED":
      return "Your account is not permitted to read the active strategy definitions.";
    case "SUPABASE_CONNECTION_ERROR":
      return "The Supabase project could not be reached. Try again shortly.";
    default:
      return "The strategy library could not be loaded. Try again shortly.";
  }
}

function StrategyDetails({ strategy }: { strategy: Strategy | null }) {
  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      {strategy && (
        <>
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{strategy.name}</DialogTitle>
              <StatusBadge tone="info" size="sm">
                {strategy.category}
              </StatusBadge>
            </div>
            <DialogDescription>{strategy.short_description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <section>
              <h3 className="font-semibold text-foreground">Definition</h3>
              <p className="mt-1.5 leading-6 text-muted-foreground">{strategy.description}</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground">Supported configuration</h3>
              <dl className="mt-2 divide-y divide-border rounded-md border border-border">
                {Object.entries(strategy.configuration).map(([key, value]) => (
                  <div key={key} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[11rem_1fr]">
                    <dt className="text-muted-foreground">{configurationLabels[key] ?? key}</dt>
                    <dd className="text-foreground">{formatConfigurationValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </>
      )}
    </DialogContent>
  );
}

function StrategiesPage() {
  const strategiesQuery = useQuery({ queryKey: ["strategies"], queryFn: getStrategies });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

  const filteredStrategies = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (strategiesQuery.data ?? []).filter((strategy) => {
      const matchesCategory = category === "All" || strategy.category === category;
      const searchableText = [
        strategy.name,
        strategy.category,
        strategy.description,
        strategy.short_description,
      ]
        .join(" ")
        .toLowerCase();
      return matchesCategory && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [category, search, strategiesQuery.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Strategies"
        description="Strategy definitions available to your Kocel bots."
      />

      {strategiesQuery.isLoading ? (
        <CardsSkeleton count={6} />
      ) : strategiesQuery.isError ? (
        <div className="panel">
          <ErrorState
            description={strategyErrorDescription(strategiesQuery.error)}
            errorCode={strategyErrorCode(strategiesQuery.error)}
            onRetry={() => void strategiesQuery.refetch()}
          />
        </div>
      ) : (strategiesQuery.data ?? []).length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={LineChart}
            title="No strategies are currently available"
            description="Kocel strategy definitions will appear here when they are published."
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search strategies"
                className="pl-9"
                placeholder="Search strategies"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="sm:w-60">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredStrategies.length === 0 ? (
            <div className="panel">
              <EmptyState
                icon={Search}
                title="No matching strategies"
                description="Try a different search or category filter."
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredStrategies.map((strategy) => (
                <article key={strategy.id} className="panel flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold text-foreground">{strategy.name}</h2>
                    <StatusBadge tone="info" size="sm">
                      {strategy.category}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground/80">
                    {strategy.short_description}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {strategy.description}
                  </p>
                  <Button
                    className="mt-4 self-start"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedStrategy(strategy)}
                  >
                    <BookOpen className="mr-2 size-4" />
                    View definition
                  </Button>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={selectedStrategy !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedStrategy(null);
        }}
      >
        <StrategyDetails strategy={selectedStrategy} />
      </Dialog>
    </div>
  );
}
