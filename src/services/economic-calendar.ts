import { supabase } from "@/integrations/supabase/client";
import type { EconomicEvent } from "./types";

export type EconomicEventFilters = {
  currency?: string | undefined;
  impact?: string | undefined;
  /** today | tomorrow | week | all */
  range?: string | undefined;
};

/** Economic calendar rows come from a connected economic-data provider only. */
export async function getEconomicEvents(
  filters: EconomicEventFilters = {},
): Promise<EconomicEvent[]> {
  let query = supabase.from("economic_events").select("*");

  if (filters.currency && filters.currency !== "all") query = query.eq("currency", filters.currency);
  if (filters.impact && filters.impact !== "all") query = query.eq("impact", filters.impact);

  if (filters.range && filters.range !== "all" && filters.range !== "custom") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (filters.range === "tomorrow") start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + (filters.range === "week" ? 7 : 1));
    query = query.gte("event_time", start.toISOString()).lt("event_time", end.toISOString());
  }

  const { data, error } = await query.order("event_time", { ascending: true }).limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as EconomicEvent[];
}

/** Upcoming events, used by the dashboard widget and future market-risk filters. */
export async function getUpcomingEvents(limit = 5): Promise<EconomicEvent[]> {
  const { data, error } = await supabase
    .from("economic_events")
    .select("*")
    .gte("event_time", new Date().toISOString())
    .order("event_time", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as EconomicEvent[];
}

/**
 * Market-risk hook for the future intelligence chain
 * (News → Market risk → Analysis → Signal / Bot filter).
 */
export async function getCurrencyRisk(currency: string): Promise<{
  currency: string;
  elevated: boolean;
  events: EconomicEvent[];
}> {
  const events = (await getUpcomingEvents(20)).filter(
    (event) => event.currency === currency && event.impact === "high",
  );
  return { currency, elevated: events.length > 0, events };
}
