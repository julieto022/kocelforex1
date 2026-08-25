import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/kocel/page-header";
import { EmptyState, ErrorState, SectionCard } from "@/components/kocel/states";
import { StatusBadge } from "@/components/kocel/status-badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  countdownTo,
  getLatestNfpPrediction,
  getNfpHistory,
  getUpcomingNfpPrediction,
  resolveFactors,
} from "@/services/nfp";
import type { NfpFactorStatus, StatusTone } from "@/services/types";

export const Route = createFileRoute("/_app/nfp-prediction")({
  component: NfpPredictionPage,
});

const factorTone: Record<NfpFactorStatus, StatusTone> = {
  positive: "success",
  negative: "danger",
  neutral: "info",
  pending: "neutral",
  analyzing: "warning",
};

function biasTone(bias: string | null): StatusTone {
  if (bias === "bullish") return "success";
  if (bias === "bearish") return "danger";
  if (bias === "neutral") return "info";
  return "neutral";
}

function NfpPredictionPage() {
  const latestQuery = useQuery({
    queryKey: ["nfp", "latest"],
    queryFn: getLatestNfpPrediction,
  });
  const upcomingQuery = useQuery({
    queryKey: ["nfp", "upcoming"],
    queryFn: getUpcomingNfpPrediction,
  });
  const historyQuery = useQuery({ queryKey: ["nfp", "history"], queryFn: () => getNfpHistory() });

  const prediction = upcomingQuery.data ?? latestQuery.data ?? null;
  const countdown = countdownTo(prediction?.release_date ?? null);
  const factors = resolveFactors(prediction);

  const impacts = [
    { label: "USD", value: prediction?.usd_impact ?? null },
    { label: "Gold (XAUUSD)", value: prediction?.gold_impact ?? null },
    { label: "EURUSD", value: prediction?.eurusd_impact ?? null },
    { label: "GBPUSD", value: prediction?.gbpusd_impact ?? null },
    { label: "NAS100", value: prediction?.nas100_impact ?? null },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="NFP Prediction"
        description="Kocel's Non-Farm Payroll outlook, built server-side from 15 labour-market and macro factors. Values appear only when the analysis engine has published them."
      />

      {latestQuery.isLoading || upcomingQuery.isLoading ? (
        <SectionCard>
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        </SectionCard>
      ) : latestQuery.isError || upcomingQuery.isError ? (
        <SectionCard>
          <ErrorState
            title="NFP prediction could not be loaded"
            onRetry={() => {
              void latestQuery.refetch();
              void upcomingQuery.refetch();
            }}
          />
        </SectionCard>
      ) : !prediction ? (
        <SectionCard>
          <EmptyState
            icon={TrendingUp}
            title="No NFP prediction published"
            description="The next Non-Farm Payroll prediction appears here once the Kocel analysis engine publishes it. Kocel never estimates figures in the browser."
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title={`Release ${new Date(prediction.release_date).toLocaleDateString()}`}
            description={prediction.expected_impact ?? undefined}
            action={
              countdown && (
                <StatusBadge tone={countdown.past ? "neutral" : "warning"} size="sm">
                  {countdown.past
                    ? "Released"
                    : `In ${countdown.days}d ${countdown.hours}h ${countdown.minutes}m`}
                </StatusBadge>
              )
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Previous", value: prediction.previous },
                { label: "Forecast", value: prediction.forecast },
                { label: "Kocel prediction", value: prediction.prediction },
                { label: "Actual", value: prediction.actual },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="num mt-1 text-lg font-semibold text-foreground">
                    {item.value ?? "—"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Confidence</span>
                <span className="num">
                  {prediction.confidence !== null ? `${prediction.confidence}%` : "—"}
                </span>
              </div>
              <Progress className="mt-1.5" value={prediction.confidence ?? 0} />
            </div>

            {prediction.analysis && (
              <p className="mt-4 text-sm text-muted-foreground">{prediction.analysis}</p>
            )}
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Expected market impact"
              description="Directional bias per instrument."
            >
              <ul className="space-y-2">
                {impacts.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">{item.label}</span>
                    <StatusBadge tone={biasTone(item.value)} size="sm">
                      {item.value ?? "Not published"}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="15-factor analysis" description="Factors without data stay pending.">
              <ul className="grid gap-2 sm:grid-cols-2">
                {factors.map((factor) => (
                  <li
                    key={factor.name}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 truncate text-foreground">{factor.name}</span>
                    <StatusBadge tone={factorTone[factor.status] ?? "neutral"} size="sm">
                      {factor.value ?? factor.status}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        </>
      )}

      <SectionCard
        title="Release history"
        description="Past releases with Kocel's prediction against the actual print."
        bodyClassName="p-0 sm:p-0"
      >
        {historyQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : historyQuery.isError ? (
          <ErrorState title="History could not be loaded" onRetry={() => historyQuery.refetch()} />
        ) : (historyQuery.data ?? []).length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No release history yet"
            description="Once NFP releases are recorded, prediction accuracy appears here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Release</th>
                  <th className="px-4 py-2 text-right font-medium">Forecast</th>
                  <th className="px-4 py-2 text-right font-medium">Kocel</th>
                  <th className="px-4 py-2 text-right font-medium">Actual</th>
                  <th className="px-4 py-2 text-right font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(historyQuery.data ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="num px-4 py-2.5">
                      {new Date(row.release_date).toLocaleDateString()}
                    </td>
                    <td className="num px-4 py-2.5 text-right">{row.forecast ?? "—"}</td>
                    <td className="num px-4 py-2.5 text-right">{row.prediction ?? "—"}</td>
                    <td className="num px-4 py-2.5 text-right font-medium">{row.actual ?? "—"}</td>
                    <td className="num px-4 py-2.5 text-right">
                      {row.confidence !== null ? `${row.confidence}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
