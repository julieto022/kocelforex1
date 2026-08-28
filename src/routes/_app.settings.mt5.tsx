import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlugZap, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConnectWizard } from "@/components/kocel/connect-wizard";
import { CardsSkeleton, EmptyState, ErrorState, SectionCard } from "@/components/kocel/states";
import { BridgeStatusBadge, StatusBadge } from "@/components/kocel/status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useConnections } from "@/lib/use-connections";
import { BRIDGE_STATUS_MODEL } from "@/services/types";
import { disconnectMT5, maskLogin } from "@/services/mt5";

export const Route = createFileRoute("/_app/settings/mt5")({
  component: MT5Settings,
});

function MT5Settings() {
  const { user } = useAuth();
  const { connections, isLoading, isError, refetch } = useConnections();
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["connections", user?.id] });

  const disconnect = useMutation({
    mutationFn: (id: string) => disconnectMT5(id),
    onSuccess: () => {
      toast.success("MT5 account disconnected");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-5">
      <SectionCard
        title="MT5 broker accounts"
        description="Kocel is broker-independent — connect as many MT5 accounts as you need."
        action={<Button size="sm" onClick={() => setWizardOpen(true)}><PlugZap className="mr-2 size-4" />Connect MT5</Button>}
        bodyClassName="p-0 sm:p-0"
      >
        {isLoading ? <div className="p-4"><CardsSkeleton count={2} /></div> : isError ? <ErrorState onRetry={refetch} /> : connections.length === 0 ? (
          <EmptyState icon={PlugZap} title="No MT5 accounts connected" description="Open MetaTrader 5, run the Kocel Bridge EA, and approve its browser authorization request." actionLabel="Connect MT5 account" onAction={() => setWizardOpen(true)} />
        ) : (
          <ul className="divide-y divide-border">
            {connections.map((connection) => (
              <li key={connection.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{connection.account_name}</p><p className="num text-xs text-muted-foreground">{connection.broker_name ?? connection.broker?.name ?? "MT5 broker"} · {maskLogin(connection.mt5_login)} · {connection.server}</p></div>
                  <div className="flex items-center gap-2"><StatusBadge tone={connection.environment.toUpperCase() === "REAL" ? "info" : "neutral"} size="sm">{connection.environment}</StatusBadge><BridgeStatusBadge status={connection.status} /></div>
                </div>
                <p className="text-xs text-muted-foreground">{BRIDGE_STATUS_MODEL[connection.status]?.explanation}</p>
                <Button size="sm" variant="ghost" disabled={disconnect.isPending} onClick={() => disconnect.mutate(connection.id)}><Trash2 className="mr-2 size-3.5" />Disconnect</Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <ConnectWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
