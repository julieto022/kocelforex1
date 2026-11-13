import { supabase } from "@/integrations/supabase/client";
import { NFP_FACTORS, type NfpFactor, type NfpPrediction } from "./types";

function normalize(row: Record<string, unknown>): NfpPrediction {
  return {
    ...(row as unknown as NfpPrediction),
    confidence_breakdown: (row["confidence_breakdown"] as Record<string, number> | null) ?? null,
    factors: (row["factors"] as NfpFactor[] | null) ?? null,
  };
}

/**
 * NFP predictions are produced by the Kocel analysis engine and stored in the
 * database. Nothing is generated in the browser — an empty result means no
 * prediction has been published yet.
 */
export async function getLatestNfpPrediction(): Promise<NfpPrediction | null> {
  const { data, error } = await supabase
    .from("nfp_predictions")
    .select("*")
    .order("release_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data as unknown as Record<string, unknown>) : null;
}

/** Upcoming (not-yet-released) prediction, used for the countdown widget. */
export async function getUpcomingNfpPrediction(): Promise<NfpPrediction | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("nfp_predictions")
    .select("*")
    .gte("release_date", today)
    .order("release_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data as unknown as Record<string, unknown>) : null;
}

/** Past releases with actual vs prediction, for the accuracy history table. */
export async function getNfpHistory(limit = 12): Promise<NfpPrediction[]> {
  const { data, error } = await supabase
    .from("nfp_predictions")
    .select("*")
    .not("actual", "is", null)
    .order("release_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => normalize(row as unknown as Record<string, unknown>));
}

/**
 * The 15 factors Kocel evaluates. Factors without stored data stay "pending"
 * so the UI never shows an invented value.
 */
export function resolveFactors(prediction: NfpPrediction | null): NfpFactor[] {
  const stored = prediction?.factors ?? [];
  return NFP_FACTORS.map((name) => {
    const match = stored.find((factor) => factor.name === name);
    return match ?? { name, status: "pending" as const, value: null };
  });
}

function releaseTimestamp(releaseDate: string, releaseTime?: string | null): number {
  if (releaseTime) {
    const scheduled = Date.parse(releaseTime);
    if (Number.isFinite(scheduled)) return scheduled;
  }
  const parsedDate = Date.parse(releaseDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) return parsedDate;

  const [year, month, day] = releaseDate.split("-").map(Number);
  const desired = Date.UTC(year!, month! - 1, day!, 8, 30);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let timestamp = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
    );
    const representedAsUtc = Date.UTC(
      Number(parts["year"]),
      Number(parts["month"]) - 1,
      Number(parts["day"]),
      Number(parts["hour"]),
      Number(parts["minute"]),
      Number(parts["second"]),
    );
    timestamp += desired - representedAsUtc;
  }
  return timestamp;
}

export function countdownTo(
  releaseDate: string | null | undefined,
  releaseTime?: string | null,
): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
} | null {
  if (!releaseDate) return null;
  const target = releaseTimestamp(releaseDate, releaseTime);
  if (Number.isNaN(target)) return null;
  const diff = target - Date.now();
  const abs = Math.abs(diff);
  return {
    days: Math.floor(abs / 86_400_000),
    hours: Math.floor((abs % 86_400_000) / 3_600_000),
    minutes: Math.floor((abs % 3_600_000) / 60_000),
    seconds: Math.floor((abs % 60_000) / 1_000),
    past: diff < 0,
  };
}
