import { supabase } from "@/integrations/supabase/client";
import type { NewsItem } from "./types";

export type NewsFilters = {
  search?: string | undefined;
  currency?: string | undefined;
  impact?: string | undefined;
  category?: string | undefined;
  market?: string | undefined;
  /** today | tomorrow | week | all */
  range?: string | undefined;
};

function rangeStart(range: string | undefined): Date | null {
  const now = new Date();
  if (range === "today" || range === "tomorrow") {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    if (range === "tomorrow") day.setDate(day.getDate() + 1);
    return day;
  }
  if (range === "week") {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    return day;
  }
  return null;
}

function rangeEnd(range: string | undefined): Date | null {
  const start = rangeStart(range);
  if (!start) return null;
  const end = new Date(start);
  if (range === "week") end.setDate(end.getDate() + 7);
  else end.setDate(end.getDate() + 1);
  return end;
}

/**
 * News is only ever real data stored by a connected news provider.
 * Kocel never fabricates articles — an empty list means "no provider connected".
 */
export async function getNews(filters: NewsFilters = {}): Promise<NewsItem[]> {
  let query = supabase.from("news").select("*");

  if (filters.category && filters.category !== "all") query = query.eq("category", filters.category);
  if (filters.impact && filters.impact !== "all") query = query.eq("impact", filters.impact);
  if (filters.currency && filters.currency !== "all") query = query.eq("currency", filters.currency);
  if (filters.market && filters.market !== "all") query = query.ilike("symbol", `%${filters.market}%`);
  if (filters.search?.trim()) query = query.ilike("title", `%${filters.search.trim()}%`);

  const start = rangeStart(filters.range);
  const end = rangeEnd(filters.range);
  if (start) query = query.gte("published_at", start.toISOString());
  if (end) query = query.lt("published_at", end.toISOString());

  const { data, error } = await query.order("published_at", { ascending: false }).limit(60);
  if (error) throw error;
  return (data ?? []) as unknown as NewsItem[];
}

export async function getLatestNews(limit = 5): Promise<NewsItem[]> {
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as NewsItem[];
}
