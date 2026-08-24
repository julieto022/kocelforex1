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
