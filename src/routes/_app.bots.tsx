import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/kocel/page-header";
import { CardsSkeleton, EmptyState, ErrorState, SectionCard } from "@/components/kocel/states";
import { StatusBadge } from "@/components/kocel/status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { deleteBot, getBots, setBotStatus } from "@/services/bots";

export const Route = createFileRoute("/_app/bots")({
  component: BotsPage,
});

function BotsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const botsQuery = useQuery({
    queryKey: ["bots", user?.id],
    queryFn: () => getBots(user!.id),
    enabled: Boolean(user?.id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bots", user?.id] });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => setBotStatus(id, status),
    onSuccess: () => {
      toast.success("Bot updated");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteBot(id),
    onSuccess: () => {
      toast.success("Bot deleted");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bots"
        description="Bots run through your connected MT5 terminal. Execution starts once the Bridge EA is live."
        actions={
          <Button size="sm" asChild>
            <Link to="/bots/create">
              <Plus className="mr-2 size-4" />
              Create bot
            </Link>
          </Button>
        }
      />

      <SectionCard title="Your bots" bodyClassName="p-0 sm:p-0">
        {botsQuery.isLoading ? (
          <div className="p-4">
            <CardsSkeleton count={3} />
          </div>
        ) : botsQuery.isError ? (
          <ErrorState onRetry={() => void botsQuery.refetch()} />
        ) : (botsQuery.data ?? []).length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No bots yet"
            description="Create a bot, pick a strategy and assign it to one of your connected MT5 accounts."
            secondary={
              <Button size="sm" asChild>
                <Link to="/bots/create">Create bot</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {(botsQuery.data ?? []).map((bot) => (
              <li
                key={bot.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{bot.name}</p>
                  <p className="num text-xs text-muted-foreground">
                    {bot.symbol} · {bot.risk_profile}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    tone={
                      bot.status === "running"
                        ? "success"
                        : bot.status === "error"
                          ? "danger"
                          : "neutral"
                    }
                    size="sm"
                  >
                    {bot.status}
                  </StatusBadge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({
                        id: bot.id,
                        status: bot.status === "running" ? "stopped" : "running",
                      })
                    }
                  >
                    {bot.status === "running" ? "Stop" : "Start"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(bot.id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
