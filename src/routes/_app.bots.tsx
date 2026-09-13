import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Edit3, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/kocel/page-header";
import { CardsSkeleton, EmptyState, ErrorState, SectionCard } from "@/components/kocel/states";
import { StatusBadge } from "@/components/kocel/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { deleteBot, getBots, updateBot } from "@/services/bots";
import { getStrategies } from "@/services/strategies";

export const Route = createFileRoute("/_app/bots")({
  component: BotsPage,
});

function BotsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [botToDelete, setBotToDelete] = useState<string | null>(null);
  const [editingBotId, setEditingBotId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    symbol: "",
    strategyId: "",
    timeframe: "",
    riskProfile: "BALANCED",
  });

  const botsQuery = useQuery({
    queryKey: ["bots", user?.id],
    queryFn: () => getBots(user!.id),
    enabled: Boolean(user?.id),
  });

  const strategiesQuery = useQuery({
    queryKey: ["strategies"],
    queryFn: getStrategies,
    enabled: Boolean(user?.id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bots", user?.id] });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteBot(id),
    onSuccess: () => {
      toast.success("Bot deleted successfully.");
      setBotToDelete(null);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateBot(editingBotId!, {
        name: editForm.name,
        symbol: editForm.symbol,
        strategyId: editForm.strategyId,
        timeframe: editForm.timeframe || null,
        riskProfile: editForm.riskProfile,
      }),
    onSuccess: () => {
      toast.success("Bot updated successfully.");
      setEditingBotId(null);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bots"
        description="Create, configure and manage your automated trading bots."
        actions={
          <Button size="sm" asChild>
            <Link to="/bots/create">
              <Plus className="mr-2 size-4" />
              + Create Bot
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
            description="Create your first bot using one of Kocel's predefined strategies."
            secondary={
              <Button size="sm" asChild>
                <Link to="/bots/create">Create Bot</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {(botsQuery.data ?? []).map((bot) => (
              <li key={bot.id} className="px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-foreground">{bot.name}</p>
                      <StatusBadge
                        tone={
                          bot.status === "RUNNING"
                            ? "success"
                            : bot.status === "ERROR"
                              ? "danger"
                              : bot.status === "WAITING"
                                ? "warning"
                                : "neutral"
                        }
                        size="sm"
                      >
                        {String(bot.status ?? "DRAFT")}
                      </StatusBadge>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">Strategy:</span>{" "}
                        {bot.strategy?.name ?? "Unassigned"}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Account:</span>{" "}
                        {bot.broker_connection?.account_name ?? "Not assigned"}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Symbol:</span> {bot.symbol}
                        {bot.timeframe ? ` · ${bot.timeframe}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start lg:self-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingBotId(bot.id);
                        setEditForm({
                          name: bot.name,
                          symbol: bot.symbol,
                          strategyId: bot.strategy_id ?? "",
                          timeframe: bot.timeframe ?? "",
                          riskProfile: (bot.risk_profile ?? "BALANCED").toUpperCase(),
                        });
                      }}
                    >
                      <Edit3 className="mr-2 size-4" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={removeMutation.isPending}
                      onClick={() => setBotToDelete(bot.id)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </Button>
                  </div>
                </div>

                {editingBotId === bot.id && (
                  <div className="mt-4 rounded-md border border-border bg-muted/20 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Bot name</Label>
                        <Input
                          value={editForm.name}
                          onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Symbol</Label>
                        <Input
                          value={editForm.symbol}
                          onChange={(event) => setEditForm({ ...editForm, symbol: event.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Risk profile</Label>
                        <Select
                          value={editForm.riskProfile}
                          onValueChange={(value) => setEditForm({ ...editForm, riskProfile: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CONSERVATIVE">CONSERVATIVE</SelectItem>
                            <SelectItem value="BALANCED">BALANCED</SelectItem>
                            <SelectItem value="AGGRESSIVE">AGGRESSIVE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Timeframe</Label>
                        <Input
                          value={editForm.timeframe}
                          onChange={(event) => setEditForm({ ...editForm, timeframe: event.target.value })}
                          placeholder="M5"
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-1.5">
                      <Label>Strategy</Label>
                      <Select
                        value={editForm.strategyId}
                        onValueChange={(value) => setEditForm({ ...editForm, strategyId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose one strategy" />
                        </SelectTrigger>
                        <SelectContent>
                          {(strategiesQuery.data ?? []).map((strategy) => (
                            <SelectItem key={strategy.id} value={strategy.id}>
                              {strategy.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateMutation.mutate()}
                        disabled={updateMutation.isPending}
                      >
                        <Save className="mr-2 size-4" />
                        Save changes
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingBotId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <AlertDialog open={Boolean(botToDelete)} onOpenChange={(open) => !open && setBotToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bot?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The bot will be removed from your account and from the
              database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (botToDelete) {
                  removeMutation.mutate(botToDelete);
                }
              }}
            >
              Delete Bot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
