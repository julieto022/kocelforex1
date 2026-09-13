import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Bot, Edit3, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import { useConnections } from "@/lib/use-connections";
import { analyzeBot } from "@/lib/functions/analysis.functions";
import type { TradingSignal } from "@/lib/trading/signals/types";
import { deleteBot, getBots, updateBot } from "@/services/bots";
import { getStrategies } from "@/services/strategies";

export const Route = createFileRoute("/_app/bots")({
  component: BotsRoute,
});

function BotsPage() {
  const { user } = useAuth();
  const { connections } = useConnections();
  const queryClient = useQueryClient();
  const [botToDelete, setBotToDelete] = useState<string | null>(null);
  const [editingBotId, setEditingBotId] = useState<string | null>(null);
  const [analysisByBot, setAnalysisByBot] = useState<Record<string, TradingSignal>>({});
  const [editForm, setEditForm] = useState({
    name: "",
    symbol: "",
    strategyId: "",
    timeframe: "",
    riskProfile: "BALANCED",
  });

  const botsQuery = useQuery({
    queryKey: ["bots", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("No authenticated user available for bots query.");
      try {
        const data = await getBots(user.id);
        return data;
      } catch (error) {
        const supabaseError = error as {
          code?: string;
          message?: string;
          details?: string;
          hint?: string;
          status?: number;
        };
        console.error("KOCEL BOTS LOAD ERROR", {
          code: supabaseError.code,
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint,
          status: supabaseError.status,
        });
        throw error;
      }
    },
    enabled: Boolean(user?.id),
  });

  const strategiesQuery = useQuery({
    queryKey: ["strategies"],
    queryFn: getStrategies,
    enabled: Boolean(user?.id),
  });

  const strategyLookup = useMemo(
    () => Object.fromEntries((strategiesQuery.data ?? []).map((strategy) => [strategy.id, strategy])),
    [strategiesQuery.data],
  );

  const connectionLookup = useMemo(
    () => Object.fromEntries(connections.map((connection) => [connection.id, connection])),
    [connections],
  );

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

  const analysisMutation = useMutation({
    mutationFn: (botId: string) => analyzeBot({ data: { botId } }),
    onSuccess: (analysis) => setAnalysisByBot((current) => ({ ...current, [analysis.botId]: analysis })),
    onError: (error: Error) => toast.error(`Analysis failed: ${error.message}`),
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
          <ErrorState
            title="Bots Load Failed"
            description={
              botsQuery.error instanceof Error
                ? botsQuery.error.message
                : "The Bots query failed. Check the console for the exact Supabase error payload."
            }
            errorCode={
              botsQuery.error && typeof botsQuery.error === "object" && "code" in botsQuery.error
                ? String((botsQuery.error as { code?: string }).code ?? "UNKNOWN")
                : undefined
            }
            onRetry={() => void botsQuery.refetch()}
          />
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
            {(botsQuery.data ?? []).map((bot) => {
              const strategy = bot.strategy_id ? strategyLookup[bot.strategy_id] ?? null : null;
              const connection = bot.broker_connection_id
                ? connectionLookup[bot.broker_connection_id] ?? null
                : null;

              return (
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
                        {strategy?.name ?? "Unassigned"}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Account:</span>{" "}
                        {connection?.account_name ?? "Not assigned"}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Symbol:</span> {bot.symbol}
                        {bot.timeframe ? ` · ${bot.timeframe}` : ""}
                      </p>
                      {typeof bot.configuration?.subStrategy === "string" && (
                        <p>
                          <span className="font-medium text-foreground">Sub-strategy:</span>{" "}
                          {bot.configuration.subStrategy}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start lg:self-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={analysisMutation.isPending}
                      onClick={() => analysisMutation.mutate(bot.id)}
                    >
                      {analysisMutation.isPending && analysisMutation.variables === bot.id ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Activity className="mr-2 size-4" />
                      )}
                      Analyze
                    </Button>
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

                {analysisByBot[bot.id] && (
                  <BotAnalysisResult analysis={analysisByBot[bot.id]!} />
                )}

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
              );
            })}
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

function BotAnalysisResult({ analysis }: { analysis: TradingSignal }) {
  const stateTone = analysis.direction === "BUY" ? "text-emerald-600" : analysis.direction === "SELL" ? "text-red-600" : "text-amber-600";
  const reason = analysisReason(analysis.reason, analysis.symbol, analysis.timeframe);
  const dataAge = analysis.dataTimestamp ? Math.max(0, Math.round((Date.now() - Date.parse(analysis.dataTimestamp)) / 1000)) : null;
  return (
    <div className="mt-4 rounded-md border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Market analysis</p>
          <p className="text-xs text-muted-foreground">
            {analysis.symbol} · {analysis.timeframe} · {analysis.dataStatus === "FRESH" ? "Fresh data" : reason}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${stateTone}`}>{analysis.state}</p>
          <p className="text-xs text-muted-foreground">Analytical confidence: {analysis.confidence}/100</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <p><span className="font-medium text-foreground">Strategy:</span> {analysis.strategyName}</p>
        <p><span className="font-medium text-foreground">Market state:</span> {analysis.marketState}</p>
        <p><span className="font-medium text-foreground">Market data:</span> {analysis.candleCount} candles{analysis.latestPrice !== null ? ` · ${analysis.latestPrice}` : ""}</p>
        <p><span className="font-medium text-foreground">Data timestamp:</span> {analysis.dataTimestamp ? new Date(analysis.dataTimestamp).toLocaleString() : reason}</p>
        <p><span className="font-medium text-foreground">Data age:</span> {dataAge === null ? "Unavailable" : `${dataAge}s`}</p>
        <p><span className="font-medium text-foreground">Generated:</span> {new Date(analysis.timestamp).toLocaleString()}</p>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{reason}</p>
      {analysis.factors.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          {analysis.factors.map((factor) => <li key={factor}>• {factor}</li>)}
        </ul>
      )}
      {Object.keys(analysis.indicators).length > 0 && (
        <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
          {Object.entries(analysis.indicators).map(([name, value]) => <span key={name}>{name}: {value === null ? "n/a" : value}</span>)}
        </div>
      )}
    </div>
  );
}

function analysisReason(code: string, symbol: string, timeframe: string): string {
  const messages: Record<string, string> = {
    MT5_CONNECTION_NOT_CONFIGURED: "This bot has no MT5 connection configured.",
    MT5_CONNECTION_NOT_FOUND: "The selected MT5 connection could not be found.",
    MT5_CONNECTION_OFFLINE: "MT5 market data is unavailable because the Bridge EA is offline.",
    MT5_CONNECTION_AUTHORIZED: "The MT5 account is authorized but the Bridge EA is not connected.",
    BRIDGE_HEARTBEAT_STALE: "The Kocel Bridge EA heartbeat is stale.",
    MARKET_DATA_NOT_SYNCED: "Market data has not been synchronized from MT5 yet.",
    MARKET_DATA_QUERY_FAILED: "The synchronized market data could not be read.",
    SYMBOL_NOT_AVAILABLE: `${symbol} is not available on the connected MT5 account.`,
    STALE_MARKET_DATA: `The latest ${timeframe} market data is stale.`,
    INSUFFICIENT_DATA: `Waiting for sufficient ${timeframe} candle history.`,
    INVALID_TIMEFRAME: `${timeframe || "This"} timeframe is not supported.`,
    STRATEGY_NOT_FOUND: "The bot strategy could not be found.",
    STRATEGY_INACTIVE: "The selected strategy is inactive.",
    STRATEGY_UNAVAILABLE: "This strategy is not available to the analysis engine.",
  };
  return messages[code] ?? code.replaceAll("_", " ").toLowerCase();
}

function BotsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return pathname === "/bots" ? <BotsPage /> : <Outlet />;
}
