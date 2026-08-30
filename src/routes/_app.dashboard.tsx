import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, PlugZap, Wallet } from "lucide-react";
import { useState } from "react";

import { ConnectWizard } from "@/components/kocel/connect-wizard";
import { DashboardWidgets } from "@/components/kocel/dashboard-widgets";
import { PageHeader } from "@/components/kocel/page-header";
import { EmptyState, SectionCard } from "@/components/kocel/states";
import { BridgeStatusBadge } from "@/components/kocel/status-badge";
import { TradingPanel } from "@/components/kocel/trading-panel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useConnections } from "@/lib/use-connections";
import { maskLogin } from "@/services/mt5";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const { active, connections } = useConnections();
  const [wizardOpen, setWizardOpen] = useState(false);

  // Determine connection status based on last_seen_at
  const isConnectionStale =
    !active?.last_seen_at || Date.now() - new Date(active.last_seen_at).getTime() > 90_000;
  const isConnected = active?.status === "CONNECTED" && !isConnectionStale;

  const metrics = [
    { label: "Balance", value: active?.balance },
    { label: "Equity", value: active?.equity },
    { label: "Free margin", value: active?.free_margin },
    { label: "Margin level", value: active?.margin_level },
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
                ? `${active.broker_name ?? active.broker?.name ?? "MT5 broker"} · ${maskLogin(active.mt5_login)} · ${active.server}`
                : undefined
            }
            action={
              active ? (
                <BridgeStatusBadge status={isConnected ? "CONNECTED" : "DISCONNECTED"} />
              ) : undefined
            }
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
            {active?.last_sync_at && (
              <p className="mt-3 text-xs text-muted-foreground">
                <Wallet className="mr-1 inline-block size-3" />
                Last synced: {new Date(active.last_sync_at).toLocaleString()}
              </p>
            )}
            {!isConnected && (
              <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Wallet className="mt-0.5 size-3.5 shrink-0" />
                {isConnectionStale
                  ? "Waiting for the Kocel Bridge EA to report this account."
                  : "MT5 Not Connected"}
              </p>
            )}
          </SectionCard>

          <TradingPanel />

          <SectionCard title="Open positions" bodyClassName="p-0 sm:p-0">
            <EmptyState
              icon={Activity}
              title="No open positions"
              description="Positions are now synced from MT5. Refresh or wait for the next heartbeat update."
            />
          </SectionCard>
        </>
      )}

      <DashboardWidgets />

      <ConnectWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
