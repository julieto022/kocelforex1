import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Database, Loader2, Play, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/kocel/page-header";
import { EmptyState, SectionCard } from "@/components/kocel/states";
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
import {
  deleteBacktestRun,
  getBacktestCatalog,
  getBacktestRun,
  runBacktest,
} from "@/lib/functions/backtest.functions";
import {
  getMarketHistorySync,
  requestMarketHistory,
} from "@/lib/functions/market-history.functions";
import { getStrategyDefinition } from "@/lib/trading/strategies/registry";
import type {
  BacktestEquityPoint,
  BacktestMetrics,
  BacktestTrade,
} from "@/lib/trading/backtest/engine";
import { useConnections } from "@/lib/use-connections";
import { getStrategies } from "@/services/strategies";

export const Route = createFileRoute("/_app/backtest")({
  validateSearch: z.object({
    strategyId: z.string().optional(),
    symbol: z.string().optional(),
  }),
  component: BacktestPage,
});

const backtestTimeframes = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"] as const;

function isBacktestTimeframe(value: string): value is (typeof backtestTimeframes)[number] {
  return backtestTimeframes.some((timeframe) => timeframe === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBacktestMetrics(value: unknown): value is BacktestMetrics {
  if (!isRecord(value)) return false;
  return (
    [
      "initialBalance",
      "finalBalance",
      "netProfit",
      "returnPercent",
      "totalTrades",
      "winningTrades",
      "losingTrades",
      "winRate",
      "expectancy",
      "averageWin",
      "averageLoss",
      "maxDrawdown",
      "maxDrawdownPercent",
      "maxLosingStreak",
    ].every((key) => typeof value[key] === "number") &&
    (typeof value["profitFactor"] === "number" || value["profitFactor"] === null)
  );
}

function isEquityPoint(value: unknown): value is BacktestEquityPoint {
  return (
    isRecord(value) &&
    typeof value["timestamp"] === "string" &&
    typeof value["balance"] === "number"
  );
}

function isBacktestTrade(value: unknown): value is BacktestTrade {
  return (
    isRecord(value) &&
    (value["direction"] === "BUY" || value["direction"] === "SELL") &&
    typeof value["openedAt"] === "string" &&
    typeof value["closedAt"] === "string" &&
    typeof value["entryPrice"] === "number" &&
    typeof value["exitPrice"] === "number" &&
    typeof value["profit"] === "number" &&
    typeof value["rMultiple"] === "number" &&
    typeof value["balanceAfter"] === "number" &&
    (value["exitReason"] === "STOP_LOSS" ||
      value["exitReason"] === "TAKE_PROFIT" ||
      value["exitReason"] === "END_OF_TEST")
  );
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function dateStartIso(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function dateEndIso(value: string) {
  const endOfDay = new Date(`${value}T23:59:59.999Z`);
  return new Date(Math.min(endOfDay.getTime(), Date.now())).toISOString();
}

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function strategyRuntime(strategy: { slug: string; configuration: Record<string, unknown> }) {
  const runtimeSlug =
    typeof strategy.configuration["runtimeStrategySlug"] === "string"
      ? strategy.configuration["runtimeStrategySlug"]
      : strategy.slug;
  if (["nfp-news-trading", "carry", "algorithmic-hft"].includes(runtimeSlug)) return null;
  if (runtimeSlug === "scalping" && typeof strategy.configuration["subStrategy"] !== "string") {
    return null;
  }
  return getStrategyDefinition(runtimeSlug) ? runtimeSlug : null;
}

function BacktestPage() {
  const { active } = useConnections();
  const queryClient = useQueryClient();
  const search = useSearch({ from: "/_app/backtest" });
  const [symbol, setSymbol] = useState(search.symbol ?? "");
  const [timeframe, setTimeframe] = useState<(typeof backtestTimeframes)[number]>("M1");
  const [strategyId, setStrategyId] = useState(search.strategyId ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [syncRequestId, setSyncRequestId] = useState("");
  const [initialBalance, setInitialBalance] = useState("10000");
  const [riskPercent, setRiskPercent] = useState("1");
  const [spread, setSpread] = useState("0");
  const [slippage, setSlippage] = useState("0");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runToDelete, setRunToDelete] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["backtest-catalog", active?.id],
    queryFn: () => getBacktestCatalog({ data: { connectionId: active!.id } }),
    enabled: Boolean(active?.id),
  });
  const strategiesQuery = useQuery({
    queryKey: ["strategies"],
    queryFn: getStrategies,
  });
  const pairs = useMemo(() => catalogQuery.data?.data ?? [], [catalogQuery.data?.data]);
  const availableSymbols = useMemo(
    () =>
      [
        ...new Set([...(catalogQuery.data?.symbols ?? []), ...pairs.map((pair) => pair.symbol)]),
      ].sort((left, right) => left.localeCompare(right)),
    [catalogQuery.data?.symbols, pairs],
  );
  const runs = useMemo(() => catalogQuery.data?.runs ?? [], [catalogQuery.data?.runs]);
  const selectedPair = pairs.find((pair) => pair.symbol === symbol && pair.timeframe === timeframe);
  const supportedStrategies = useMemo(
    () =>
      (strategiesQuery.data ?? []).filter(
        (strategy) =>
          strategy.is_active &&
          strategyRuntime({
            slug: strategy.slug,
            configuration: strategy.configuration ?? {},
          }) !== null,
      ),
    [strategiesQuery.data],
  );

  const historySyncQuery = useQuery({
    queryKey: ["market-history-sync", active?.id, syncRequestId],
    queryFn: () =>
      getMarketHistorySync({ data: { connectionId: active!.id, requestId: syncRequestId } }),
    enabled: Boolean(active?.id && syncRequestId),
    refetchInterval: (query) =>
      query.state.data?.status === "PENDING" || query.state.data?.status === "SYNCING"
        ? 2_000
        : false,
  });

  const syncMutation = useMutation({
    mutationFn: () => {
      if (!active) throw new Error("Select an MT5 account first.");
      if (!symbol || !timeframe || !startDate || !endDate) {
        throw new Error("Select a symbol, timeframe, and date range.");
      }
      if (startDate > endDate) throw new Error("Start date must be on or before end date.");
      return requestMarketHistory({
        data: {
          connectionId: active.id,
          symbol,
          timeframe,
          startAt: dateStartIso(startDate),
          endAt: dateEndIso(endDate),
        },
      });
    },
    onSuccess: async (request) => {
      setSyncRequestId(request.id);
      toast.success("History download queued for the MT5 Bridge EA.");
      await queryClient.invalidateQueries({
        queryKey: ["market-history-sync", active?.id, request.id],
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!availableSymbols.includes(symbol) && availableSymbols.length > 0) {
      setSymbol(availableSymbols[0]!);
    }
  }, [availableSymbols, symbol]);

  useEffect(() => {
    if (selectedPair && (!startDate || !endDate)) {
      setStartDate(dateOnly(selectedPair.firstAt));
      setEndDate(dateOnly(selectedPair.lastAt));
    }
  }, [selectedPair, startDate, endDate]);

  useEffect(() => {
    if (!supportedStrategies.some((strategy) => strategy.id === strategyId)) {
      const deepLinkedStrategy = supportedStrategies.find(
        (strategy) => strategy.id === search.strategyId,
      );
      if (deepLinkedStrategy) setStrategyId(deepLinkedStrategy.id);
      else if (supportedStrategies[0]) setStrategyId(supportedStrategies[0].id);
    }
  }, [search.strategyId, supportedStrategies, strategyId]);

  useEffect(() => {
    if (runs.length === 0) {
      if (selectedRunId) setSelectedRunId("");
      return;
    }
    if (!runs.some((savedRun) => savedRun.id === selectedRunId)) {
      setSelectedRunId(runs[0]!.id);
    }
  }, [runs, selectedRunId]);

  const runQuery = useQuery({
    queryKey: ["backtest-run", active?.id, selectedRunId],
    queryFn: () => getBacktestRun({ data: { connectionId: active!.id, runId: selectedRunId } }),
    enabled: Boolean(active?.id && selectedRunId),
  });

  const runMutation = useMutation({
    mutationFn: () => {
      if (!active) throw new Error("Select an MT5 account first.");
      if (!startDate || !endDate) throw new Error("Select a start and end date.");
      const startAt = new Date(`${startDate}T00:00:00.000Z`);
      const endAt = new Date(`${endDate}T23:59:59.999Z`);
      if (
        !Number.isFinite(startAt.getTime()) ||
        !Number.isFinite(endAt.getTime()) ||
        startAt >= endAt
      ) {
        throw new Error("The selected date range is invalid.");
      }
      return runBacktest({
        data: {
          connectionId: active.id,
          strategyId,
          symbol,
          timeframe,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          initialBalance: Number(initialBalance),
          riskPercent: Number(riskPercent),
          spread: Number(spread),
          slippage: Number(slippage),
        },
      });
    },
    onSuccess: async (run) => {
      setSelectedRunId(run.id);
      toast.success("Backtest completed and saved.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["backtest-catalog", active?.id] }),
        queryClient.invalidateQueries({ queryKey: ["backtest-run", active?.id, run.id] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (runId: string) => {
      if (!active) throw new Error("Select an MT5 account first.");
      return deleteBacktestRun({ data: { connectionId: active.id, runId } });
    },
    onSuccess: async (_, runId) => {
      if (selectedRunId === runId) setSelectedRunId("");
      setRunToDelete(null);
      toast.success("Backtest deleted.");
      await queryClient.invalidateQueries({ queryKey: ["backtest-catalog", active?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const run = runQuery.data;
  const metrics = run && isBacktestMetrics(run.metrics) ? run.metrics : null;
  const equityCurve = Array.isArray(run?.equity_curve)
    ? run.equity_curve.filter(isEquityPoint)
    : [];
  const trades = Array.isArray(run?.trades) ? run.trades.filter(isBacktestTrade) : [];
  const canRun =
    Boolean(active && symbol && timeframe && strategyId && startDate && endDate) &&
    !runMutation.isPending;

  useEffect(() => {
    setSymbol("");
    setTimeframe("M1");
    setStartDate("");
    setEndDate("");
    setSelectedRunId("");
    setSyncRequestId("");
  }, [active?.id]);

  const lastSyncCompletion = useRef("");
  useEffect(() => {
    const sync = historySyncQuery.data;
    if (!sync || (sync.status !== "COMPLETED" && sync.status !== "FAILED")) return;
    if (lastSyncCompletion.current === sync.id) return;
    lastSyncCompletion.current = sync.id;
    void queryClient.invalidateQueries({ queryKey: ["backtest-catalog", active?.id] });
  }, [active?.id, historySyncQuery.data, queryClient]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Backtest"
        description="Replay historical candles synced by your MT5 Bridge EA. Simulations do not send orders or guarantee future performance."
      />

      <SectionCard
        title="EA market data"
        description={
          active
            ? `Symbols are reported by the Kocel Bridge EA from ${active.account_name}'s MT5 Market Watch. Download historical ranges on demand below.`
            : "Select or connect an MT5 account to use its EA-reported symbols and historical candles."
        }
        action={
          <div className="flex items-center gap-2">
            <StatusBadge
              tone={
                catalogQuery.isError ? "danger" : availableSymbols.length ? "success" : "warning"
              }
              size="sm"
            >
              {catalogQuery.isError
                ? "Data error"
                : catalogQuery.isLoading
                  ? "Loading"
                  : availableSymbols.length
                    ? `${availableSymbols.length} symbols`
                    : "No EA symbols"}
            </StatusBadge>
            <Button
              size="sm"
              variant="outline"
              disabled={catalogQuery.isFetching || !active}
              onClick={() => void catalogQuery.refetch()}
            >
              <RefreshCw
                className={`mr-1.5 size-3.5 ${catalogQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh symbols
            </Button>
          </div>
        }
      >
        {catalogQuery.isError ? (
          <p className="text-sm text-destructive">
            {catalogQuery.error instanceof Error
              ? catalogQuery.error.message
              : "The EA candle catalog could not be loaded."}
          </p>
        ) : availableSymbols.length === 0 ? (
          <EmptyState
            icon={Database}
            title={active ? "Waiting for MT5 Market Watch symbols" : "No MT5 account selected"}
            description="Keep the Kocel Bridge EA connected and add the instruments you want to test to MT5 Market Watch. Symbols and candles are never synthesized."
          />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {pairs.length} symbol/timeframe datasets currently have candle data. A newly listed
              symbol can be selected and downloaded using the controls below.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {availableSymbols.map((item) => {
                const itemPairs = pairs.filter((pair) => pair.symbol === item);
                return (
                  <li key={item} className="rounded-md border border-border p-3">
                    <p className="font-medium">{item}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {itemPairs.length
                        ? itemPairs.map((pair) => `${pair.timeframe}: ${pair.count}`).join(" · ")
                        : "No candles synced yet"}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Configure simulation"
        description="The engine uses the same Kocel strategy evaluator as bot analysis, enters on the next candle open, and checks stop/target against each candle's range."
      >
        {active && availableSymbols.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Select value={symbol} onValueChange={(value) => setSymbol(value)}>
                <SelectTrigger aria-label="Backtest symbol">
                  <SelectValue placeholder="Choose symbol" />
                </SelectTrigger>
                <SelectContent>
                  {availableSymbols.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timeframe</Label>
              <Select
                value={timeframe}
                onValueChange={(value) => {
                  if (isBacktestTimeframe(value)) setTimeframe(value);
                }}
              >
                <SelectTrigger aria-label="Backtest timeframe">
                  <SelectValue placeholder="Choose timeframe" />
                </SelectTrigger>
                <SelectContent>
                  {backtestTimeframes.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Strategy</Label>
              <Select value={strategyId} onValueChange={setStrategyId}>
                <SelectTrigger aria-label="Backtest strategy">
                  <SelectValue placeholder="Choose strategy" />
                </SelectTrigger>
                <SelectContent>
                  {supportedStrategies.map((strategy) => (
                    <SelectItem key={strategy.id} value={strategy.id}>
                      {strategy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {strategiesQuery.isError && (
                <p className="text-xs text-destructive">Strategies could not be loaded.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                type="date"
                max={endDate || undefined}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input
                type="date"
                min={startDate || undefined}
                max={dateOnly(new Date().toISOString())}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Starting balance</Label>
              <Input
                type="number"
                min="1"
                step="100"
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Risk per trade (%)</Label>
              <Input
                type="number"
                min="0.1"
                max="5"
                step="0.1"
                value={riskPercent}
                onChange={(event) => setRiskPercent(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Spread (price units)</Label>
              <Input
                type="number"
                min="0"
                step="0.00001"
                value={spread}
                onChange={(event) => setSpread(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Slippage (price units)</Label>
              <Input
                type="number"
                min="0"
                step="0.00001"
                value={slippage}
                onChange={(event) => setSlippage(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <div className="flex w-full flex-col gap-2">
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={
                    syncMutation.isPending ||
                    !symbol ||
                    !startDate ||
                    !endDate ||
                    startDate > endDate
                  }
                  onClick={() => syncMutation.mutate()}
                >
                  {syncMutation.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Database className="mr-2 size-4" />
                  )}
                  Download EA history
                </Button>
                <Button
                  className="w-full"
                  disabled={!canRun || strategiesQuery.isLoading || !supportedStrategies.length}
                  onClick={() => runMutation.mutate()}
                >
                  {runMutation.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 size-4" />
                  )}
                  Run backtest
                </Button>
              </div>
            </div>
            {historySyncQuery.data && (
              <p
                className="text-xs text-muted-foreground md:col-span-2 xl:col-span-4"
                role="status"
              >
                History sync {historySyncQuery.data.status.toLowerCase()} for{" "}
                {historySyncQuery.data.symbol} {historySyncQuery.data.timeframe}
                {historySyncQuery.data.status === "COMPLETED"
                  ? ` — ${historySyncQuery.data.candle_count} candles available.`
                  : ""}
                {historySyncQuery.data.error_message
                  ? ` — ${historySyncQuery.data.error_message}`
                  : ""}
              </p>
            )}
            {historySyncQuery.isError && (
              <p className="text-xs text-destructive md:col-span-2 xl:col-span-4" role="alert">
                {historySyncQuery.error instanceof Error
                  ? historySyncQuery.error.message
                  : "History sync status could not be loaded."}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Connect the MT5 Bridge EA and add at least one instrument to MT5 Market Watch to
            download and test its history.
          </p>
        )}
        <p className="mt-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          Historical downloads are limited to 5,000 candles per request. Results use
          percentage-of-equity risk sizing and the spread/slippage you enter. Contract
          specifications, commission, swaps, gaps, and live execution differences are not modeled.
          Same-candle stop/target ambiguity is resolved conservatively in favor of the stop.
        </p>
      </SectionCard>

      {metrics && run && (
        <>
          <SectionCard
            title={`${run.strategy_name} · ${run.symbol} ${run.timeframe}`}
            description={`${formatDate(run.start_at)} – ${formatDate(run.end_at)} · ${run.candle_count} candles · Engine ${run.engine_version}`}
            action={
              <Button
                size="sm"
                variant="outline"
                disabled={deleteMutation.isPending}
                onClick={() => setRunToDelete(run.id)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete run
              </Button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Net profit"
                value={formatNumber(metrics.netProfit)}
                tone={metrics.netProfit >= 0}
              />
              <Metric
                label="Return"
                value={`${formatNumber(metrics.returnPercent)}%`}
                tone={metrics.returnPercent >= 0}
              />
              <Metric label="Win rate" value={`${formatNumber(metrics.winRate)}%`} />
              <Metric
                label="Profit factor"
                value={metrics.profitFactor === null ? "∞" : formatNumber(metrics.profitFactor)}
              />
              <Metric label="Trades" value={String(metrics.totalTrades)} />
              <Metric label="Expectancy" value={formatNumber(metrics.expectancy)} />
              <Metric label="Max drawdown" value={`${formatNumber(metrics.maxDrawdownPercent)}%`} />
              <Metric label="Final balance" value={formatNumber(metrics.finalBalance)} />
            </div>
          </SectionCard>

          <SectionCard
            title="Equity curve"
            description="Simulated balance after each closed trade."
          >
            {equityCurve.length > 1 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equityCurve} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value: string) => new Date(value).toLocaleDateString()}
                      minTickGap={32}
                    />
                    <YAxis domain={["auto", "auto"]} />
                    <Tooltip
                      labelFormatter={(value) => formatDate(String(value))}
                      formatter={(value) => [formatNumber(Number(value)), "Balance"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No completed trades"
                description="The strategy did not generate any valid entries in this data range."
              />
            )}
            {runQuery.isError && (
              <p className="text-sm text-destructive">
                {runQuery.error instanceof Error
                  ? runQuery.error.message
                  : "The saved backtest could not be loaded."}
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Trade ledger"
            description="Simulated entries, exits, R multiples, and exit reasons."
          >
            {trades.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No trades were generated for this run.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Direction</th>
                      <th className="py-2 pr-3">Opened</th>
                      <th className="py-2 pr-3">Closed</th>
                      <th className="py-2 pr-3 text-right">Entry</th>
                      <th className="py-2 pr-3 text-right">Exit</th>
                      <th className="py-2 pr-3 text-right">R</th>
                      <th className="py-2 pr-3 text-right">P/L</th>
                      <th className="py-2">Exit reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...trades]
                      .reverse()
                      .slice(0, 100)
                      .map((trade, index) => (
                        <tr key={`${trade.openedAt}-${index}`}>
                          <td
                            className={
                              trade.direction === "BUY"
                                ? "py-2 pr-3 text-primary"
                                : "py-2 pr-3 text-destructive"
                            }
                          >
                            {trade.direction}
                          </td>
                          <td className="py-2 pr-3 text-xs">{formatDate(trade.openedAt)}</td>
                          <td className="py-2 pr-3 text-xs">{formatDate(trade.closedAt)}</td>
                          <td className="num py-2 pr-3 text-right">
                            {formatNumber(trade.entryPrice, 5)}
                          </td>
                          <td className="num py-2 pr-3 text-right">
                            {formatNumber(trade.exitPrice, 5)}
                          </td>
                          <td className="num py-2 pr-3 text-right">
                            {formatNumber(trade.rMultiple)}
                          </td>
                          <td
                            className={`num py-2 pr-3 text-right ${trade.profit >= 0 ? "text-primary" : "text-destructive"}`}
                          >
                            {formatNumber(trade.profit)}
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {trade.exitReason.replaceAll("_", " ")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}

      <SectionCard
        title="Saved runs"
        description="Backtest results are private to the account that created them."
      >
        {catalogQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading saved runs…</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Your completed backtests will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {runs.map((savedRun) => (
              <li
                key={savedRun.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => setSelectedRunId(savedRun.id)}
                >
                  <span className="block truncate text-sm font-medium">
                    {savedRun.strategy_name} · {savedRun.symbol} {savedRun.timeframe}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {new Date(savedRun.created_at).toLocaleString()} · {savedRun.candle_count}{" "}
                    candles
                  </span>
                </button>
                <div className="flex items-center gap-3">
                  {isBacktestMetrics(savedRun.metrics) && (
                    <span
                      className={
                        savedRun.metrics.netProfit >= 0
                          ? "num text-sm text-primary"
                          : "num text-sm text-destructive"
                      }
                    >
                      {formatNumber(savedRun.metrics.netProfit)}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${savedRun.strategy_name} backtest`}
                    onClick={() => setRunToDelete(savedRun.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <AlertDialog
        open={Boolean(runToDelete)}
        onOpenChange={(open) => !open && setRunToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this backtest?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved result, equity curve, and trade ledger will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (runToDelete) deleteMutation.mutate(runToDelete);
              }}
            >
              Delete backtest
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`num mt-1 text-lg font-semibold ${tone === undefined ? "" : tone ? "text-primary" : "text-destructive"}`}
      >
        {value}
      </p>
    </div>
  );
}
