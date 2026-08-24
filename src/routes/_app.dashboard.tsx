import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, PlugZap, Wallet } from "lucide-react";
import { useState } from "react";

import { ConnectWizard } from "@/components/kocel/connect-wizard";
import { PageHeader } from "@/components/kocel/page-header";
import { EmptyState, SectionCard } from "@/components/kocel/states";
import { BridgeStatusBadge } from "@/components/kocel/status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useConnections } from "@/lib/use-connections";
import { getDashboard } from "@/services/dashboard";
import { getTrades } from "@/services/trades";
import { maskLogin } from "@/services/mt5";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const { active, connections } = useConnections();
  const [wizardOpen, setWizardOpen] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", active?.id ?? null],
    queryFn: () => getDashboard(active),
  });

  const tradesQuery = useQuery({
    queryKey: ["trades", user?.id, active?.id ?? null, "open"],
    queryFn: () => getTrades(user!.id, { connectionId: active?.id ?? null, status: "open" }),
    enabled: Boolean(user?.id),
  });

  const metrics = [
    { label: "Balance", value: dashboardQuery.data?.summary?.balance },
    { label: "Equity", value: dashboardQuery.data?.summary?.equity },
    { label: "Free margin", value: dashboardQuery.data?.summary?.free_margin },
    { label: "Today's P/L", value: dashboardQuery.data?.summary?.today_pl },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Live account information comes from your connected MT5 terminal."
        actions={
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <PlugZap className="mr-2 size-4" />
            Connect MT5
          </Button>
        }
      />

      {connections.length === 0 ? (
        <SectionCard title="No MT5 account connected">
          <EmptyState
            icon={PlugZap}
            title="Connect your first MT5 broker account"
            description="Kocel is broker-independent. Add an MT5 account and install the Kocel Bridge EA to start seeing live data."
            actionLabel="Connect MT5 account"
            onAction={() => setWizardOpen(true)}
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title={active ? `${active.account_name}` : "Account"}
            description={
              active
                ? `${active.broker?.name ?? "MT5 broker"} · ${maskLogin(active.mt5_login)} · ${active.server}`
                : undefined
            }
            action={active ? <BridgeStatusBadge status={active.status} /> : undefined}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="num mt-1 text-lg font-semibold text-foreground">
                    {metric.value ?? "—"}
                  </p>
                </div>
              ))}
            </div>
            {dashboardQuery.data?.message && (
              <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Wallet className="mt-0.5 size-3.5 shrink-0" />
                {dashboardQuery.data.message}
              </p>
            )}
          </SectionCard>

          <SectionCard title="Open positions" bodyClassName="p-0 sm:p-0">
            {(tradesQuery.data ?? []).length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No open positions"
                description="Positions reported by the Kocel Bridge EA appear here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {(tradesQuery.data ?? []).map((trade) => (
                  <li key={trade.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="num font-medium text-foreground">{trade.symbol}</span>
                    <span className="text-muted-foreground">{trade.type}</span>
                    <span className="num text-foreground">{trade.volume ?? "—"}</span>
                    <span className="num text-muted-foreground">{trade.profit ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}

      <ConnectWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
