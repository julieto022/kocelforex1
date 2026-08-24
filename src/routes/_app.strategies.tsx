import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LineChart } from "lucide-react";

import { PageHeader } from "@/components/kocel/page-header";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/kocel/states";
import { StatusBadge } from "@/components/kocel/status-badge";
import { getStrategies } from "@/services/strategies";

export const Route = createFileRoute("/_app/strategies")({
  component: StrategiesPage,
});

function StrategiesPage() {
  const strategiesQuery = useQuery({ queryKey: ["strategies"], queryFn: getStrategies });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Strategies"
        description="Strategy definitions available to your Kocel bots."
      />

      {strategiesQuery.isLoading ? (
        <CardsSkeleton count={6} />
      ) : strategiesQuery.isError ? (
        <ErrorState onRetry={() => void strategiesQuery.refetch()} />
      ) : (strategiesQuery.data ?? []).length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={LineChart}
            title="No strategies available yet"
            description="Strategy definitions will appear here as they are published to your workspace."
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(strategiesQuery.data ?? []).map((strategy) => (
            <article key={strategy.id} className="panel p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">{strategy.name}</h2>
                <StatusBadge tone={strategy.status === "active" ? "success" : "neutral"} size="sm">
                  {strategy.status}
                </StatusBadge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{strategy.description}</p>
              <p className="num mt-3 text-xs text-muted-foreground">
                {[strategy.timeframe, strategy.markets.join(", ")].filter(Boolean).join(" · ")}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
