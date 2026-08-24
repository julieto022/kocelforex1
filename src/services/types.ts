export type BridgeStatus =
  | "NOT_CONNECTED"
  | "WAITING_FOR_BRIDGE"
  | "CONNECTING"
  | "AUTHENTICATING"
  | "CONNECTED"
  | "DISCONNECTED"
  | "ERROR"
  | "EXPIRED";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export const BRIDGE_STATUS_MODEL: Record<
  BridgeStatus,
  { label: string; tone: StatusTone; explanation: string; action?: string }
> = {
  NOT_CONNECTED: {
    label: "Not connected",
    tone: "neutral",
    explanation: "This account has not been linked to a Kocel Bridge EA yet.",
    action: "Start setup",
  },
  WAITING_FOR_BRIDGE: {
    label: "Waiting for Bridge EA",
    tone: "warning",
    explanation: "Enter your Kocel connection code in the Bridge EA on your MT5 terminal.",
    action: "View setup steps",
  },
  CONNECTING: {
    label: "Connecting…",
    tone: "warning",
    explanation: "MT5 terminal detected. Establishing the Kocel Bridge session.",
  },
  AUTHENTICATING: {
    label: "Verifying connection…",
    tone: "info",
    explanation: "Verifying the connection code reported by your MT5 terminal.",
  },
  CONNECTED: {
    label: "Connected",
    tone: "success",
    explanation: "The Kocel Bridge EA is reporting this MT5 account.",
    action: "View details",
  },
  DISCONNECTED: {
    label: "Disconnected",
    tone: "danger",
    explanation: "The Kocel Bridge EA stopped reporting. Check that MT5 and the EA are running.",
    action: "Retry connection",
  },
  ERROR: {
    label: "Connection failed",
    tone: "danger",
    explanation: "The Bridge EA reported an error while connecting.",
    action: "Retry connection",
  },
  EXPIRED: {
    label: "Code expired",
    tone: "warning",
    explanation: "The connection code expired before the Bridge EA reported in.",
    action: "Generate new code",
  },
};

export type Broker = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  status: string;
  supported: boolean;
  capabilities: string[];
  connection_config: Record<string, unknown>;
  sort_order: number;
};

export type BrokerConnection = {
  id: string;
  user_id: string;
  broker_id: string;
  account_name: string;
  nickname: string | null;
  mt5_login: string;
  server: string;
  account_type: string | null;
  environment: "demo" | "real" | string;
  status: BridgeStatus;
  connection_code: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  broker?: Broker | null;
};

export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  avatar_url: string | null;
  referral_code: string | null;
  onboarding_completed: boolean;
};

export type NotificationPreferences = {
  trade: boolean;
  bot: boolean;
  connection: boolean;
  risk: boolean;
  email: boolean;
  push: boolean;
};

export type UserSettings = {
  id: string;
  user_id: string;
  theme: string;
  timezone: string;
  language: string;
  date_format: string;
  default_currency: string;
  default_risk_profile: string;
  active_connection_id: string | null;
  notifications: NotificationPreferences;
};

export type Strategy = {
  id: string;
  name: string;
  slug: string;
  description: string;
  timeframe: string | null;
  markets: string[];
  status: string;
};

export type Bot = {
  id: string;
  name: string;
  symbol: string;
  status: "running" | "stopped" | "paused" | "error" | "waiting" | string;
  risk_profile: string;
  broker_connection_id: string | null;
  strategy_id: string | null;
  created_at: string;
};

export type Trade = {
  id: string;
  ticket: string | null;
  symbol: string;
  type: string;
  volume: number | null;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  profit: number | null;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
};

export type AccountSummary = {
  balance: number | null;
  equity: number | null;
  free_margin: number | null;
  margin_level: number | null;
  today_pl: number | null;
  total_pl: number | null;
  currency: string;
};

/* ---------------------------------------------------------------------------
 * Phase 1 expansion: News, Economic Calendar, NFP, Signals, Community
 * ------------------------------------------------------------------------- */

export type ImpactLevel = "high" | "medium" | "low";

export const IMPACT_MODEL: Record<ImpactLevel, { label: string; tone: StatusTone }> = {
  high: { label: "High impact", tone: "danger" },
  medium: { label: "Medium impact", tone: "warning" },
  low: { label: "Low impact", tone: "neutral" },
};

export type NewsCategory =
  | "forex"
  | "economic"
  | "central_banks"
  | "commodities"
  | "indices"
  | "global_markets";

export const NEWS_CATEGORIES: { id: NewsCategory; label: string; description: string }[] = [
  { id: "forex", label: "Forex", description: "Currency-market news." },
  { id: "economic", label: "Economic", description: "Economic reports and macroeconomic developments." },
  {
    id: "central_banks",
    label: "Central Banks",
    description: "Interest-rate decisions, speeches and monetary-policy developments.",
  },
  { id: "commodities", label: "Commodities", description: "Gold, oil and other relevant commodity news." },
  { id: "indices", label: "Indices", description: "Major index-related market developments." },
  { id: "global_markets", label: "Global Markets", description: "Major international market events." },
];

export const NEWS_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"] as const;

export const NEWS_MARKETS = ["forex", "gold", "indices", "commodities", "crypto"] as const;

export type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  content: string | null;
  source: string | null;
  url: string | null;
  image_url: string | null;
  category: string;
  impact: ImpactLevel | string;
  currency: string | null;
  symbol: string | null;
  published_at: string | null;
  created_at: string;
};

export type EconomicEvent = {
  id: string;
  event_name: string;
  currency: string;
  impact: ImpactLevel | string;
  previous: string | null;
  forecast: string | null;
  actual: string | null;
  event_time: string;
  source: string | null;
};

export type MarketBias = "bullish" | "bearish" | "neutral" | string;

export type NfpFactorStatus = "positive" | "negative" | "neutral" | "pending" | "analyzing";

export type NfpFactor = { name: string; status: NfpFactorStatus; value?: string | null };

export const NFP_FACTORS: string[] = [
  "Previous NFP",
  "Current Forecast",
  "Employment trends",
  "Unemployment Rate",
  "Average Hourly Earnings",
  "ADP Employment",
  "Initial Jobless Claims",
  "Continuing Claims",
  "JOLTS",
  "Labor-market strength",
  "Economic growth",
  "Inflation environment",
  "USD strength",
  "Historical NFP reactions",
  "Recent market volatility",
];

export type NfpPrediction = {
  id: string;
  release_date: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  prediction: string | null;
  confidence: number | null;
  confidence_breakdown: Record<string, number> | null;
  usd_impact: MarketBias | null;
  gold_impact: MarketBias | null;
  eurusd_impact: MarketBias | null;
  gbpusd_impact: MarketBias | null;
  nas100_impact: MarketBias | null;
  expected_impact: string | null;
  factors: NfpFactor[] | null;
  analysis: string | null;
  created_at: string;
  updated_at: string;
};

export type SignalDirection = "BUY" | "SELL" | "WAIT" | "NO TRADE" | "EXPIRED" | string;
export type SignalStatus = "active" | "expiring" | "expired" | "invalidated" | string;

export const SIGNAL_FACTORS: string[] = [
  "Trend",
  "Momentum",
  "Volatility",
  "Market Structure",
  "Support/Resistance",
  "Candlestick",
  "Multi-Timeframe",
  "Spread",
  "News Risk",
];

export type Signal = {
  id: string;
  user_id: string | null;
  symbol: string;
  direction: SignalDirection;
  timeframe: string | null;
  confidence: number | null;
  confidence_breakdown: Record<string, number> | null;
  entry: number | null;
  entry_zone: string | null;
  stop_loss: number | null;
  take_profit: number | null;
  risk_reward: string | null;
  market_condition: string | null;
  analysis: { name: string; status: string; note?: string | null }[] | null;
  result: string | null;
  status: SignalStatus;
  valid_until: string | null;
  created_at: string;
};

export type CommunityCategory =
  | "general"
  | "market"
  | "idea"
  | "education"
  | "news"
  | "question";

export const COMMUNITY_CATEGORIES: { id: CommunityCategory; label: string }[] = [
  { id: "general", label: "General Discussion" },
  { id: "market", label: "Market Discussion" },
  { id: "idea", label: "Trading Idea" },
  { id: "education", label: "Education" },
  { id: "news", label: "News Discussion" },
  { id: "question", label: "Question" },
];

export type TradingIdea = {
  direction?: "BUY" | "SELL" | string;
  timeframe?: string;
  entry?: string;
  stop_loss?: string;
  take_profit?: string;
  risk_reward?: string;
  analysis?: string;
};

export type CommunityAuthor = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export type CommunityPost = {
  id: string;
  user_id: string;
  category: CommunityCategory | string;
  content: string;
  image_url: string | null;
  symbol: string | null;
  idea: TradingIdea | null;
  created_at: string;
  updated_at: string;
  author?: CommunityAuthor | null;
  reaction_count?: number;
  comment_count?: number;
  reacted?: boolean;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  author?: CommunityAuthor | null;
};

export const REPORT_REASONS = [
  "Spam",
  "Harassment",
  "Scam",
  "Misleading information",
  "Inappropriate content",
  "Other",
] as const;

export const COMMUNITY_NOTIFICATION_TYPES = [
  "community_like",
  "community_comment",
  "community_reply",
  "community_follow",
  "community_report",
  "community_share",
  "community_activity",
] as const;
