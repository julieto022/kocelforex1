import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/kocel/page-header";
import { EmptyState, ErrorState, SectionCard } from "@/components/kocel/states";
import { StatusBadge } from "@/components/kocel/status-badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SIGNAL_TIMEFRAMES,
  getSignalHistory,
  getSignals,
  resolveAnalysis,
  signalTone,
  statusTone,
} from "@/services/signals";
import { SIGNAL_FACTORS, type Signal } from "@/services/types";

export const Route = createFileRoute("/_app/signal-prediction")({
  head: () => ({
    meta: [
      { title: "Signal Prediction — Kocel Forex Hub" },
      {
        name: "description",
        content:
          "Kocel signal predictions with 9-dimension confidence analysis, entry, stop loss and take profit levels.",
      },
      { property: "og:title", content: "Signal Prediction — Kocel Forex Hub" },
      {
        property: "og:description",
        content:
          "Kocel signal predictions with 9-dimension confidence analysis for your connected MT5 accounts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignalPredictionPage,
});

const SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30"];

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function factorTone(status: string) {
  if (status === "bullish" || status === "positive") return "success" as const;
  if (status === "bearish" || status === "negative") return "danger" as const;
  if (status === "neutral") return "info" as const;
  return "neutral" as const;
}

function SignalCard({ signal }: { signal: Signal }) {
  const analysis = resolveAnalysis(signal);
  const confidence = Number(signal.confidence ?? 0);

  return (
    <SectionCard
      title={`${signal.symbol} · ${signal.timeframe ?? "—"}`}
      description={`Created ${formatTime(signal.created_at)}`}
      action={
        <div className="flex items-center gap-2">
          <StatusBadge tone={signalTone(String(signal.direction))} size="sm">
            {signal.direction}
          </StatusBadge>
          <StatusBadge tone={statusTone(String(signal.status))} size="sm" dot={false}>
            {statusLabel(String(signal.status))}
          </StatusBadge>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Confidence</span>
            <span className="num font-semibold text-foreground">
              {signal.confidence == null ? "—" : `${confidence.toFixed(0)}%`}
            </span>
          </div>
          <Progress value={signal.confidence == null ? 0 : confidence} className="mt-2 h-1.5" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Entry", value: signal.entry ?? signal.entry_zone },
            { label: "Stop loss", value: signal.stop_loss },
            { label: "Take profit", value: signal.take_profit },
            { label: "Risk / reward", value: signal.risk_reward },
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-border bg-muted/40 p-3">
              <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="num mt-1 text-sm font-semibold text-foreground">{item.value ?? "—"}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Analysis ({SIGNAL_FACTORS.length} dimensions)
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {analysis.map((factor) => (
              <li
                key={factor.name}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-xs"
              >
                <span className="truncate text-muted-foreground">{factor.name}</span>
                <StatusBadge tone={factorTone(String(factor.status))} size="sm" dot={false}>
                  {factor.status}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </div>

        {signal.market_condition && (
          <p className="text-xs text-muted-foreground">
            Market condition: <span className="text-foreground">{signal.market_condition}</span>
          </p>
        )}
        {signal.valid_until && (
          <p className="text-xs text-muted-foreground">
            Valid until <span className="num">{formatTime(signal.valid_until)}</span>
          </p>
        )}
      </div>
    </SectionCard>
  );
}

function SignalPredictionPage() {
  const [symbol, setSymbol] = useState("all");
  const [timeframe, setTimeframe] = useState("all");
  const [status, setStatus] = useState("all");

  const signalsQuery = useQuery({
    queryKey: ["signals", { symbol, timeframe, status }],
    queryFn: () => getSignals({ symbol, timeframe, status }),
  });

  const historyQuery = useQuery({
    queryKey: ["signal-history"],
    queryFn: () => getSignalHistory(),
  });

  const signals = signalsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Signal Prediction"
        description="Signals are produced by the Kocel analysis engine and stored server-side. Nothing is generated in your browser — an empty list means no signal has been published yet."
      />

      <SectionCard>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue placeholder="Symbol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All symbols</SelectItem>
              {SYMBOLS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All timeframes</SelectItem>
              {SIGNAL_TIMEFRAMES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expiring">Expiring</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="invalidated">Invalidated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {signalsQuery.isLoading ? (
        <SectionCard title="Signals">
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        </SectionCard>
      ) : signalsQuery.isError ? (
        <SectionCard title="Signals">
          <ErrorState
            title="Signals could not be loaded"
            description="We couldn't reach the signal store. Try again in a moment."
            onRetry={() => signalsQuery.refetch()}
          />
        </SectionCard>
      ) : signals.length === 0 ? (
        <SectionCard title="Signals">
          <EmptyState
            icon={Target}
            title="No signals published"
            description="Signals appear here as soon as the Kocel analysis engine publishes one for these filters."
          />
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}

      <SectionCard
        title="Signal history"
        description="Completed signals with their recorded result."
        bodyClassName="p-0 sm:p-0"
      >
        {historyQuery.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (historyQuery.data ?? []).length === 0 ? (
          <EmptyState
            icon={Target}
            title="No completed signals yet"
            description="Once signals close, their outcome is recorded here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Timeframe</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(historyQuery.data ?? []).map((signal) => (
                  <TableRow key={signal.id}>
                    <TableCell className="num font-medium">{signal.symbol}</TableCell>
                    <TableCell>
                      <StatusBadge tone={signalTone(String(signal.direction))} size="sm">
                        {signal.direction}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{signal.timeframe ?? "—"}</TableCell>
                    <TableCell className="num">
                      {signal.confidence == null ? "—" : `${Number(signal.confidence).toFixed(0)}%`}
                    </TableCell>
                    <TableCell>{signal.result ?? "—"}</TableCell>
                    <TableCell className="num text-muted-foreground">
                      {formatTime(signal.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
