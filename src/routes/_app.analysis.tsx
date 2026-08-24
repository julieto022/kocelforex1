import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";

import { PageHeader } from "@/components/kocel/page-header";
import { EmptyState, SectionCard } from "@/components/kocel/states";
import { useAuth } from "@/lib/auth";
import { useConnections } from "@/lib/use-connections";
import { getTrades } from "@/services/trades";

export const Route = createFileRoute("/_app/analysis")({
  component: AnalysisPage,
});

function AnalysisPage() {
  const { user } = useAuth();
  const { active } = useConnections();

  const tradesQuery = useQuery({
    queryKey: ["trades", user?.id, active?.id ?? null, "closed"],
    queryFn: () => getTrades(user!.id, { connectionId: active?.id ?? null, status: "closed" }),
    enabled: Boolean(user?.id),
  });

  const trades = tradesQuery.data ?? [];
  const wins = trades.filter((trade) => (trade.profit ?? 0) > 0).length;
  const losses = trades.filter((trade) => (trade.profit ?? 0) < 0).length;
  const net = trades.reduce((total, trade) => total + (trade.profit ?? 0), 0);

  const stats = [
    { label: "Closed trades", value: trades.length ? String(trades.length) : "—" },
    { label: "Wins", value: trades.length ? String(wins) : "—" },
    { label: "Losses", value: trades.length ? String(losses) : "—" },
    {
      label: "Win rate",
      value: trades.length ? `${Math.round((wins / trades.length) * 100)}%` : "—",
    },
    { label: "Net P/L", value: trades.length ? net.toFixed(2) : "—" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analysis"
        description="Performance is calculated only from real trades reported for your connected accounts."
      />

      <SectionCard title="Performance summary">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-md border border-border bg-muted/40 p-3">
              <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
              <p className="num mt-1 text-lg font-semibold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {trades.length === 0 && (
        <div className="panel">
          <EmptyState
            icon={BarChart3}
            title="No trading history yet"
            description="Once your MT5 terminal reports closed trades, Kocel calculates win rate, drawdown and net performance here."
          />
        </div>
      )}
    </div>
  );
}
