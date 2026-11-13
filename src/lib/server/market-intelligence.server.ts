import { logger } from "@/lib/api/logger";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { EconomicEvent, NfpFactor, NfpPrediction, NewsItem } from "@/services/types";

const NEWS_FEEDS = [
  { name: "FXStreet", url: "https://www.fxstreet.com/rss/news", kind: "markets" },
  {
    name: "CNBC Business",
    url: "https://www.cnbc.com/id/10001147/device/rss/rss.html",
    kind: "markets",
  },
  {
    name: "Federal Reserve",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    kind: "central_banks",
  },
  {
    name: "European Central Bank",
    url: "https://www.ecb.europa.eu/rss/press.html",
    kind: "central_banks",
  },
] as const;

const TRADE_NEWS_TERMS =
  /\b(forex|currency|currencies|dollar|euro|pound|yen|gold|oil|crude|commodit|bond|treasury|yield|stock|equity|equities|market|rate|inflation|payroll|employment|jobs|unemployment|central bank|federal reserve|ecb|boj|boe|fed)\b/i;
const LABOR_NEWS_TERMS =
  /\b(nfp|nonfarm|non-farm|payroll|employment|jobs|jobless|unemployment|hiring|layoffs|claims|wages|adp|jolts|labor market|labour market)\b/i;
const POSITIVE_LABOR_TERMS =
  /\b(hiring rises|hiring accelerat|jobs growth|payrolls? (?:rise|beat|increase|grow)|claims (?:fall|drop|decline)|unemployment (?:falls|drops|declines)|wages? (?:accelerat|rise|grow)|strong(?:er)? jobs|robust employment)\b/i;
const NEGATIVE_LABOR_TERMS =
  /\b(layoffs?|job cuts|claims (?:rise|increase|jump)|unemployment (?:rises|increases|jumps)|jobs (?:fall|miss|decline|weaken)|payrolls? (?:fall|miss|decline|weaken)|hiring slows?|labor market cools?|wages? slow)\b/i;

type NewsFilters = {
  search?: string | undefined;
  category?: string | undefined;
  currency?: string | undefined;
  impact?: string | undefined;
  range?: string | undefined;
};

export type MarketNewsResult = { items: NewsItem[]; warnings: string[]; updatedAt: string };
export type MarketCalendarResult = {
  items: EconomicEvent[];
  warnings: string[];
  updatedAt: string;
};
type NfpSource = { name: string; url: string; summary: string; published_at: string | null };
export type LiveNfpOutlook = NfpPrediction & {
  release_time: string | null;
  release_date_estimated: boolean;
  model_version: string;
  sources: NfpSource[];
  warnings: string[];
};
export type NfpCountdownSchedule = {
  releaseDate: string;
  releaseAt: string;
  isEstimated: boolean;
  source: string;
};

type ForexFactoryEvent = {
  title?: unknown;
  country?: unknown;
  date?: unknown;
  impact?: unknown;
  forecast?: unknown;
  previous?: unknown;
};

type CachedCalendar = {
  result: MarketCalendarResult;
  expiresAt: number;
};

let calendarCache: CachedCalendar | null = null;
const CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

type BlsObservation = { year: string; period: string; value: number };
type BlsResponse = {
  status: string;
  Results?: { series?: Array<{ data?: Array<{ year: string; period: string; value: string }> }> };
  message?: string[];
};

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function tagText(xml: string, name: string): string {
  const expression = new RegExp(
    `<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}\\s*>`,
    "i",
  );
  const value = expression.exec(xml)?.[1] ?? "";
  return decodeXml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function tagAttribute(xml: string, name: string, attribute: string): string {
  const expression = new RegExp(`<${name}\\b[^>]*\\b${attribute}=["']([^"']+)["']`, "i");
  return decodeXml(expression.exec(xml)?.[1] ?? "");
}

function secureUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function articleCategory(title: string, summary: string, feedKind: string): string {
  const text = `${title} ${summary}`;
  if (/\b(gold|oil|crude|commodity|commodities|copper)\b/i.test(text)) return "commodities";
  if (/\b(stock|stocks|equity|equities|index|indices|nasdaq|s&p|futures)\b/i.test(text))
    return "indices";
  if (/\b(federal reserve|central bank|ecb|boj|boe|interest rate|monetary policy)\b/i.test(text))
    return "central_banks";
  if (/\b(payroll|employment|jobs|inflation|cpi|gdp|claims|economic)\b/i.test(text))
    return "economic";
  if (/\b(forex|currency|currencies|dollar|euro|pound|yen)\b/i.test(text)) return "forex";
  return feedKind === "central_banks" ? "central_banks" : "global_markets";
}

function articleCurrency(title: string, summary: string): string | null {
  const text = `${title} ${summary}`;
  if (/\b(USD|U\.S\. dollar|US dollar|Federal Reserve|Fed|NFP|nonfarm)\b/i.test(text)) return "USD";
  if (/\b(EUR|euro|European Central Bank|ECB)\b/i.test(text)) return "EUR";
  if (/\b(GBP|pound sterling|Bank of England|BoE)\b/i.test(text)) return "GBP";
  if (/\b(JPY|yen|Bank of Japan|BoJ)\b/i.test(text)) return "JPY";
  if (/\b(AUD|Australian dollar|Reserve Bank of Australia)\b/i.test(text)) return "AUD";
  if (/\b(CAD|Canadian dollar|Bank of Canada)\b/i.test(text)) return "CAD";
  if (/\b(CHF|Swiss franc|Swiss National Bank)\b/i.test(text)) return "CHF";
  if (/\b(NZD|New Zealand dollar|Reserve Bank of New Zealand)\b/i.test(text)) return "NZD";
  return null;
}

function articleImpact(title: string, summary: string): string {
  const text = `${title} ${summary}`;
  if (
    /\b(rate decision|interest rate|NFP|nonfarm|non-farm|CPI|inflation|FOMC|emergency|surprise)\b/i.test(
      text,
    )
  )
    return "high";
  if (/\b(payroll|employment|jobs|GDP|claims|central bank|earnings|yield)\b/i.test(text))
    return "medium";
  return "low";
}

function parseFeed(xml: string, feed: (typeof NEWS_FEEDS)[number]): NewsItem[] {
  const blocks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]!);
  const now = Date.now();
  return blocks.flatMap((block) => {
    const title = tagText(block, "title");
    const summary = tagText(block, "description").slice(0, 900);
    const url = secureUrl(tagText(block, "link") || tagAttribute(block, "link", "href"));
    const published = Date.parse(tagText(block, "pubDate") || tagText(block, "date"));
    if (!title || !url || !Number.isFinite(published) || published > now) return [];
    if (feed.kind === "markets" && !TRADE_NEWS_TERMS.test(`${title} ${summary}`)) return [];
    if (
      feed.kind === "central_banks" &&
      !/\b(rate|inflation|monetary|employment|policy|yield)\b/i.test(title)
    )
      return [];

    return [
      {
        id: url,
        title,
        summary: summary || null,
        content: null,
        source: tagText(block, "source") || feed.name,
        url,
        source_url: url,
        image_url: null,
        category: articleCategory(title, summary, feed.kind),
        impact: articleImpact(title, summary),
        currency: articleCurrency(title, summary),
        symbol: null,
        symbols: [],
        published_at: new Date(published).toISOString(),
        created_at: new Date(published).toISOString(),
      } as NewsItem,
    ];
  });
}

async function fetchFeed(feed: (typeof NEWS_FEEDS)[number]): Promise<NewsItem[]> {
  const response = await fetch(feed.url, {
    headers: {
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      "user-agent": "KocelTradingHub/1.0 (+market news reader)",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`${feed.name} returned HTTP ${response.status}.`);
  return parseFeed(await response.text(), feed);
}

function inRange(publishedAt: string | null, range: string | undefined) {
  if (!publishedAt || !range || range === "all") return true;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (range === "tomorrow") start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (range === "week" ? 7 : 1));
  const value = Date.parse(publishedAt);
  return value >= start.getTime() && value < end.getTime();
}

export async function getMarketNews(filters: NewsFilters = {}): Promise<MarketNewsResult> {
  const settled = await Promise.allSettled(NEWS_FEEDS.map(fetchFeed));
  const warnings = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];
    const feed = NEWS_FEEDS[index]!;
    logger.warn("system", "market news source unavailable", {
      source: feed.name,
      message: result.reason instanceof Error ? result.reason.message : "Unknown feed error",
    });
    return [`${feed.name} is temporarily unavailable.`];
  });
  const allItems = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const unique = new Map(allItems.map((item) => [item.url, item]));
  const search = filters.search?.trim().toLowerCase();
  const items = [...unique.values()]
    .filter(
      (item) => !search || `${item.title} ${item.summary ?? ""}`.toLowerCase().includes(search),
    )
    .filter(
      (item) =>
        !filters.category || filters.category === "all" || item.category === filters.category,
    )
    .filter(
      (item) =>
        !filters.currency || filters.currency === "all" || item.currency === filters.currency,
    )
    .filter((item) => !filters.impact || filters.impact === "all" || item.impact === filters.impact)
    .filter((item) => inRange(item.published_at, filters.range))
    .sort(
      (left, right) => Date.parse(right.published_at ?? "") - Date.parse(left.published_at ?? ""),
    )
    .slice(0, 80);

  if (allItems.length === 0) {
    throw new Error(warnings.join(" ") || "No market news sources returned articles.");
  }
  return { items, warnings, updatedAt: new Date().toISOString() };
}

type CalendarFilters = {
  currency?: string | undefined;
  impact?: string | undefined;
  range?: string | undefined;
  limit?: number | undefined;
};

function calendarImpact(value: unknown): string {
  if (typeof value !== "string") return "low";
  const impact = value.toLowerCase();
  return impact === "high" || impact === "medium" ? impact : "low";
}

function calendarRangeMatches(eventTime: string, range: string | undefined, now: Date): boolean {
  if (!range || range === "all") return true;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "tomorrow") start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + (range === "week" ? 7 : 1));
  const eventTimestamp = Date.parse(eventTime);
  return eventTimestamp >= start.getTime() && eventTimestamp < end.getTime();
}

async function fetchCalendar(): Promise<MarketCalendarResult> {
  const response = await fetch(CALENDAR_URL, {
    headers: { accept: "application/json", "user-agent": "KocelTradingHub/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Economic calendar returned HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("Economic calendar returned an invalid response.");

  const now = Date.now();
  const items = payload.flatMap((value): EconomicEvent[] => {
    if (!value || typeof value !== "object") return [];
    const event = value as ForexFactoryEvent;
    const title = typeof event.title === "string" ? event.title.trim() : "";
    const currency = typeof event.country === "string" ? event.country.trim() : "";
    const eventTime =
      typeof event.date === "string" && Number.isFinite(Date.parse(event.date))
        ? new Date(event.date).toISOString()
        : null;
    if (!title || !currency || !eventTime || Date.parse(eventTime) < now) return [];
    return [
      {
        id: `${eventTime}:${currency}:${title}`,
        event_name: title,
        currency,
        impact: calendarImpact(event.impact),
        previous: typeof event.previous === "string" ? event.previous || null : null,
        forecast: typeof event.forecast === "string" ? event.forecast || null : null,
        actual: null,
        event_time: eventTime,
        source: "Forex Factory calendar",
      },
    ];
  });

  return {
    items: items.sort((left, right) => Date.parse(left.event_time) - Date.parse(right.event_time)),
    warnings: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function getMarketCalendar(
  filters: CalendarFilters = {},
): Promise<MarketCalendarResult> {
  let result: MarketCalendarResult;
  if (calendarCache && calendarCache.expiresAt > Date.now()) {
    result = calendarCache.result;
  } else {
    try {
      result = await fetchCalendar();
      calendarCache = { result, expiresAt: Date.now() + 5 * 60_000 };
    } catch (error) {
      logger.warn("system", "economic calendar source unavailable", {
        message: error instanceof Error ? error.message : "Unknown calendar error",
      });
      if (!calendarCache) throw error;
      result = {
        ...calendarCache.result,
        warnings: ["The live calendar source is temporarily unavailable; showing cached events."],
      };
    }
  }

  const now = new Date();
  return {
    ...result,
    items: result.items
      .filter((event) => Date.parse(event.event_time) >= now.getTime())
      .filter(
        (event) =>
          !filters.currency || filters.currency === "all" || event.currency === filters.currency,
      )
      .filter(
        (event) => !filters.impact || filters.impact === "all" || event.impact === filters.impact,
      )
      .filter((event) => calendarRangeMatches(event.event_time, filters.range, now))
      .slice(0, Math.min(Math.max(filters.limit ?? 60, 1), 100)),
  };
}

function observations(response: BlsResponse): BlsObservation[] {
  const rows = response.Results?.series?.[0]?.data ?? [];
  return rows
    .filter((row) => /^M(?:0[1-9]|1[0-2])$/.test(row.period) && Number.isFinite(Number(row.value)))
    .map((row) => ({ year: row.year, period: row.period, value: Number(row.value) }))
    .sort(
      (left, right) =>
        Number(right.year) - Number(left.year) ||
        Number(right.period.slice(1)) - Number(left.period.slice(1)),
    );
}

async function getBlsSeries(seriesId: string): Promise<BlsObservation[]> {
  const response = await fetch(`https://api.bls.gov/publicAPI/v1/timeseries/data/${seriesId}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`BLS series ${seriesId} returned HTTP ${response.status}.`);
  const payload = (await response.json()) as BlsResponse;
  if (payload.status !== "REQUEST_SUCCEEDED") {
    throw new Error(
      `BLS series ${seriesId} failed: ${payload.message?.join("; ") || "Unknown error"}`,
    );
  }
  const rows = observations(payload);
  if (rows.length < 4) throw new Error(`BLS series ${seriesId} returned insufficient history.`);
  return rows;
}

function newYorkReleaseTime(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Invalid NFP release date.");
  const desired = Date.UTC(year, month - 1, day, 8, 30);
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
  return new Date(timestamp).toISOString();
}

function estimatedNfpRelease(now: Date): NfpCountdownSchedule {
  for (let monthOffset = 0; monthOffset < 4; monthOffset += 1) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1));
    const firstFridayDay = 1 + ((5 - monthStart.getUTCDay() + 7) % 7);
    const releaseDate = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), firstFridayDay),
    )
      .toISOString()
      .slice(0, 10);
    const releaseAt = newYorkReleaseTime(releaseDate);
    if (Date.parse(releaseAt) > now.getTime()) {
      return {
        releaseDate,
        releaseAt,
        isEstimated: true,
        source: "Estimated from the usual BLS first-Friday, 8:30 a.m. ET schedule",
      };
    }
  }
  throw new Error("Could not estimate the next monthly payroll release.");
}

export async function getNfpCountdownSchedule(): Promise<NfpCountdownSchedule> {
  const now = new Date();
  const { data, error } = await supabaseAdmin
    .from("nfp_events")
    .select("release_date, release_time, source")
    .gt("release_time", now.toISOString())
    .order("release_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    return {
      releaseDate: data.release_date,
      releaseAt: data.release_time,
      isEstimated: false,
      source: data.source || "Published NFP release schedule",
    };
  }
  return estimatedNfpRelease(now);
}

function stateFor(value: number | null): NfpFactor["status"] {
  if (value === null || !Number.isFinite(value)) return "pending";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function formatThousands(value: number): string {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? "+" : ""}${rounded.toLocaleString()}K`;
}

function laborNewsScore(items: NewsItem[]): number {
  const relevant = items.filter((item) =>
    LABOR_NEWS_TERMS.test(`${item.title} ${item.summary ?? ""}`),
  );
  const scores = relevant.slice(0, 12).map((item) => {
    const text = `${item.title} ${item.summary ?? ""}`;
    return (POSITIVE_LABOR_TERMS.test(text) ? 1 : 0) - (NEGATIVE_LABOR_TERMS.test(text) ? 1 : 0);
  });
  return scores.length
    ? Math.max(-1, Math.min(1, scores.reduce((sum, score) => sum + score, 0) / scores.length))
    : 0;
}

let nfpCache: { value: LiveNfpOutlook; expiresAt: number } | null = null;

export async function getLiveNfpOutlook(): Promise<LiveNfpOutlook> {
  if (nfpCache && nfpCache.expiresAt > Date.now()) return nfpCache.value;

  let laborNewsWarning: string | null = null;
  const [employment, unemployment, hourlyEarnings, laborArticles] = await Promise.all([
    getBlsSeries("CES0000000001"),
    getBlsSeries("LNS14000000"),
    getBlsSeries("CES0500000003"),
    fetchFeed(NEWS_FEEDS[0]).catch((error: unknown) => {
      logger.warn("system", "NFP labor news source unavailable", {
        message: error instanceof Error ? error.message : "Unknown feed error",
      });
      laborNewsWarning = "FXStreet labor headlines are temporarily unavailable.";
      return [];
    }),
  ]);
  const changes = employment
    .slice(0, 7)
    .slice(0, -1)
    .map((row, index) => {
      const prior = employment[index + 1]!;
      return row.value - prior.value;
    });
  const recentThree = changes.slice(0, 3);
  const recentAverage = recentThree.reduce((sum, change) => sum + change, 0) / recentThree.length;
  const previousPayrollChange = changes[0]!;
  const unemploymentChange = unemployment[0]!.value - unemployment[3]!.value;
  const wageThreeMonthChange = hourlyEarnings[0]!.value - hourlyEarnings[3]!.value;
  const newsScore = laborNewsScore(laborArticles);
  const momentum = previousPayrollChange - recentAverage;
  const modelEstimate =
    previousPayrollChange * 0.55 +
    recentAverage * 0.45 +
    Math.sign(momentum) * Math.min(25, Math.abs(momentum) * 0.15) +
    newsScore * 15;

  const { data: event, error: eventError } = await supabaseAdmin
    .from("nfp_events")
    .select("release_date, release_time, previous, forecast, actual")
    .gte("release_date", new Date().toISOString().slice(0, 10))
    .order("release_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (eventError) throw eventError;

  const estimatedRelease = estimatedNfpRelease(new Date());
  const releaseDate = event?.release_date ?? estimatedRelease.releaseDate;
  const releaseTime = event?.release_time ?? estimatedRelease.releaseAt;
  const unemploymentStatus = stateFor(-unemploymentChange);
  const momentumStatus = stateFor(momentum);
  const newsStatus = stateFor(newsScore);
  const wageStatus = stateFor(wageThreeMonthChange);
  const factors: NfpFactor[] = [
    { name: "Previous NFP", status: "neutral", value: formatThousands(previousPayrollChange) },
    {
      name: "Current Forecast",
      status: event?.forecast ? "neutral" : "pending",
      value: event?.forecast ?? "No consensus value available",
    },
    {
      name: "Employment trends",
      status: momentumStatus,
      value: `Latest ${formatThousands(previousPayrollChange)}; 3-month average ${formatThousands(recentAverage)}`,
    },
    {
      name: "Unemployment Rate",
      status: unemploymentStatus,
      value: `${unemployment[0]!.value.toFixed(1)}%; ${unemploymentChange >= 0 ? "+" : ""}${unemploymentChange.toFixed(1)} pp over 3 months`,
    },
    {
      name: "Average Hourly Earnings",
      status: wageStatus,
      value: `$${hourlyEarnings[0]!.value.toFixed(2)}; ${wageThreeMonthChange >= 0 ? "+" : ""}$${wageThreeMonthChange.toFixed(2)} over 3 months`,
    },
    {
      name: "Labor-market strength",
      status: newsStatus,
      value: laborArticles.some((article) => LABOR_NEWS_TERMS.test(article.title))
        ? `${laborArticles.filter((article) => LABOR_NEWS_TERMS.test(article.title)).length} recent labor-related FXStreet headlines reviewed`
        : laborNewsWarning
          ? "FXStreet labor headlines unavailable; omitted from this analysis"
          : "No recent labor headlines matched the source filter",
    },
  ];

  const directionScore =
    Math.sign(momentum) + Math.sign(-unemploymentChange) + Math.sign(newsScore);
  const outlook = directionScore > 0 ? "stronger" : directionScore < 0 ? "weaker" : "mixed";
  const alignment = Math.round(
    100 *
      (Math.abs(momentum) + Math.abs(unemploymentChange) + Math.abs(newsScore) > 0
        ? Math.abs(directionScore) / 3
        : 0.33),
  );
  const bias = outlook === "stronger" ? "bullish" : outlook === "weaker" ? "bearish" : "neutral";
  const recentLaborArticles = laborArticles
    .filter((article) => LABOR_NEWS_TERMS.test(`${article.title} ${article.summary ?? ""}`))
    .slice(0, 6);
  const sources: NfpSource[] = [
    {
      name: "U.S. Bureau of Labor Statistics — Total nonfarm employment",
      url: "https://api.bls.gov/publicAPI/v1/timeseries/data/CES0000000001",
      summary: `Official monthly employment level, in thousands; month-to-month changes form the model baseline. Latest observation: ${employment[0]!.year}-${employment[0]!.period.slice(1)}.`,
      published_at: null,
    },
    {
      name: "U.S. Bureau of Labor Statistics — Unemployment rate",
      url: "https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000",
      summary: `Official unemployment-rate series used as a three-month directional factor. Latest observation: ${unemployment[0]!.year}-${unemployment[0]!.period.slice(1)}.`,
      published_at: null,
    },
    {
      name: "U.S. Bureau of Labor Statistics — Average hourly earnings",
      url: "https://api.bls.gov/publicAPI/v1/timeseries/data/CES0500000003",
      summary: `Official average hourly earnings series used as labor-market context. Latest observation: ${hourlyEarnings[0]!.year}-${hourlyEarnings[0]!.period.slice(1)}.`,
      published_at: null,
    },
    ...recentLaborArticles.map((article) => ({
      name: article.source ?? "FXStreet",
      url: article.url ?? "https://www.fxstreet.com/",
      summary: article.title,
      published_at: article.published_at,
    })),
  ];

  const prediction: LiveNfpOutlook = {
    id: `live-${releaseDate}`,
    release_date: releaseDate,
    release_time: releaseTime,
    release_date_estimated: !event?.release_date,
    forecast: event?.forecast ?? null,
    previous: event?.previous ?? formatThousands(previousPayrollChange),
    actual: event?.actual ?? null,
    prediction: formatThousands(modelEstimate),
    confidence: Math.min(75, Math.max(25, alignment)),
    confidence_breakdown: {
      payroll_momentum: Math.sign(momentum),
      unemployment_trend: Math.sign(-unemploymentChange),
      labor_headline_tone: Math.sign(newsScore),
    },
    usd_impact: bias,
    gold_impact: bias === "bullish" ? "bearish" : bias === "bearish" ? "bullish" : "neutral",
    eurusd_impact: bias === "bullish" ? "bearish" : bias === "bearish" ? "bullish" : "neutral",
    gbpusd_impact: bias === "bullish" ? "bearish" : bias === "bearish" ? "bullish" : "neutral",
    nas100_impact: bias === "bullish" ? "bearish" : bias === "bearish" ? "bullish" : "neutral",
    expected_impact: `Evidence leans ${outlook}; directional reactions are not assured.`,
    factors,
    analysis:
      `On-demand heuristic estimate: ${formatThousands(modelEstimate)}. ` +
      `The baseline weights the latest BLS payroll change (55%) and recent three-month average (45%), ` +
      `then adjusts modestly for payroll momentum and labor-news headline tone. ` +
      `Unemployment and wage trends are displayed as context, not converted into a guaranteed forecast. ` +
      `This is a transparent, uncalibrated model—not a probability or trading recommendation.`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    model_version: "bls-news-heuristic-v1",
    sources,
    warnings: laborNewsWarning ? [laborNewsWarning] : [],
  };
  nfpCache = { value: prediction, expiresAt: Date.now() + 15 * 60_000 };
  return prediction;
}
