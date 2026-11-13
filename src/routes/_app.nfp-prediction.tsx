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
  getNfpHistory,
  getUpcomingNfpPrediction,
  resolveFactors,
} from "@/services/nfp";
import { getNfpMarketOutlook } from "@/lib/functions/market-intelligence.functions";
import type { NfpFactorStatus, StatusTone } from "@/services/types";

type NfpSource = {
  name: string;
  url: string;
  summary: string;
  published_at: string | null;
};

function isNfpSource(value: unknown): value is NfpSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source["name"] === "string" &&
    typeof source["url"] === "string" &&
    typeof source["summary"] === "string" &&
    (typeof source["published_at"] === "string" || source["published_at"] === null)
  );
}

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

function formatReleaseDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function NfpPredictionPage() {
  const outlookQuery = useQuery({
    queryKey: ["nfp", "live-outlook"],
    queryFn: () => getNfpMarketOutlook(),
    staleTime: 15 * 60_000,
  });
  const upcomingQuery = useQuery({
    queryKey: ["nfp", "upcoming"],
    queryFn: getUpcomingNfpPrediction,
  });
  const historyQuery = useQuery({ queryKey: ["nfp", "history"], queryFn: () => getNfpHistory() });

  const prediction = outlookQuery.data ?? upcomingQuery.data ?? null;
  const releaseTime =
    prediction && "release_time" in prediction && typeof prediction.release_time === "string"
      ? prediction.release_time
      : null;
  const countdown = countdownTo(prediction?.release_date ?? null, releaseTime);
  const factors = resolveFactors(prediction);
  const sources =
    prediction && "sources" in prediction && Array.isArray(prediction.sources)
      ? prediction.sources.filter(isNfpSource)
      : [];
  const modelVersion =
    prediction && "model_version" in prediction && typeof prediction.model_version === "string"
      ? prediction.model_version
      : null;
  const releaseDateEstimated =
    prediction !== null &&
    "release_date_estimated" in prediction &&
    prediction.release_date_estimated === true;
  const warnings =
    prediction && "warnings" in prediction && Array.isArray(prediction.warnings)
      ? prediction.warnings.filter((warning): warning is string => typeof warning === "string")
      : [];

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
        description="A transparent, on-demand labor-market outlook combining official BLS data with attributed market headlines. It is an uncalibrated estimate, not a probability or trading recommendation."
      />

      {outlookQuery.isError && upcomingQuery.data && (
        <p
          className="rounded-md border border-warning/40 bg-warning/12 px-3 py-2 text-xs text-muted-foreground"
          role="status"
        >
          The live outlook is unavailable; showing the published prediction instead.
        </p>
      )}
      {warnings.length > 0 && (
        <p
          className="rounded-md border border-warning/40 bg-warning/12 px-3 py-2 text-xs text-muted-foreground"
          role="status"
        >
          Some evidence is unavailable: {warnings.join(" ")}
        </p>
      )}

      {outlookQuery.isLoading || upcomingQuery.isLoading ? (
        <SectionCard>
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        </SectionCard>
      ) : outlookQuery.isError && !upcomingQuery.data ? (
        <SectionCard>
          <ErrorState
            title="NFP prediction could not be loaded"
            description={
              outlookQuery.error instanceof Error
                ? outlookQuery.error.message
                : "Official labor data is temporarily unavailable."
            }
            onRetry={() => void outlookQuery.refetch()}
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
            title={`Release ${formatReleaseDate(prediction.release_date)}`}
            description={[
              prediction.expected_impact,
              releaseTime ? `Scheduled release time: ${releaseTime}.` : null,
              releaseDateEstimated
                ? "Date estimate: first Friday rule; confirm the official BLS schedule."
                : null,
            ]
              .filter(Boolean)
              .join(" ")}
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
                <span>Evidence alignment (not a probability)</span>
                <span className="num">
                  {prediction.confidence !== null ? `${prediction.confidence}%` : "—"}
                </span>
              </div>
              <Progress className="mt-1.5" value={prediction.confidence ?? 0} />
            </div>

            {prediction.analysis && (
              <p className="mt-4 text-sm text-muted-foreground">{prediction.analysis}</p>
            )}
            {modelVersion && (
              <p className="mt-2 text-[0.68rem] text-muted-foreground">
                Model {modelVersion} · Updated {new Date(prediction.updated_at).toLocaleString()}
              </p>
            )}
          </SectionCard>

          {sources.length > 0 && (
            <SectionCard
              title="Evidence and sources"
              description="Use the original sources to verify each input; headlines can be incomplete or revised."
            >
              <ul className="space-y-3">
                {sources.map((source) => (
                  <li
                    key={`${source.name}-${source.url}`}
                    className="rounded-md border border-border p-3"
                  >
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {source.name}
                    </a>
                    <p className="mt-1 text-sm text-muted-foreground">{source.summary}</p>
                    {source.published_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(source.published_at).toLocaleString()}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

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

            <SectionCard
              title="15-factor analysis"
              description="Factors without data stay pending."
            >
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
