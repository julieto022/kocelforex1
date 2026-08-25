/** Shared enums for the Phase 2 data layer. */

export const ACCOUNT_STATUS = ["ACTIVE", "SUSPENDED", "PENDING", "DELETED"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUS)[number];

export const CONNECTION_ENVIRONMENTS = ["DEMO", "REAL"] as const;
export type ConnectionEnvironment = (typeof CONNECTION_ENVIRONMENTS)[number];

export const CONNECTION_STATUSES = [
  "NOT_CONNECTED",
  "WAITING_FOR_BRIDGE",
  "CONNECTING",
  "AUTHENTICATING",
  "CONNECTED",
  "DISCONNECTED",
  "ERROR",
  "EXPIRED",
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/** Connection-code lifecycle, independent of the Bridge session status. */
export const CODE_STATES = [
  "CREATED",
  "WAITING",
  "CLAIMED",
  "AUTHENTICATING",
  "CONNECTED",
  "EXPIRED",
  "FAILED",
  "CANCELLED",
] as const;
export type CodeState = (typeof CODE_STATES)[number];

export const BOT_STATUSES = [
  "DRAFT",
  "STOPPED",
  "RUNNING",
  "PAUSED",
  "WAITING",
  "ERROR",
] as const;
export type BotStatus = (typeof BOT_STATUSES)[number];

export const TRADE_STATUSES = ["OPEN", "CLOSED", "CANCELLED", "REJECTED"] as const;
export type TradeStatus = (typeof TRADE_STATUSES)[number];

export const SIGNAL_STATUSES = [
  "ANALYZING",
  "ACTIVE",
  "WAIT",
  "NO_TRADE",
  "EXPIRED",
  "INVALIDATED",
  "COMPLETED",
] as const;
export type SignalDataStatus = (typeof SIGNAL_STATUSES)[number];

export const COMMUNITY_POST_CATEGORIES = [
  "GENERAL",
  "MARKET",
  "TRADING_IDEA",
  "EDUCATION",
  "NEWS",
  "QUESTION",
] as const;

export const REPORT_STATUSES = ["PENDING", "REVIEWING", "RESOLVED", "DISMISSED"] as const;

export const BROKER_CAPABILITIES = [
  "forex",
  "metals",
  "indices",
  "crypto",
  "stocks",
  "commodities",
  "hedging",
  "netting",
  "automated_trading",
] as const;
export type BrokerCapability = (typeof BROKER_CAPABILITIES)[number];

export const NOTIFICATION_TYPES = [
  "ACCOUNT_CONNECTED",
  "ACCOUNT_DISCONNECTED",
  "BRIDGE_OFFLINE",
  "BOT_UPDATE",
  "TRADE_UPDATE",
  "RISK_ALERT",
  "NEWS_ALERT",
  "NFP_ALERT",
  "SIGNAL_ALERT",
  "COMMUNITY_LIKE",
  "COMMUNITY_COMMENT",
  "COMMUNITY_REPLY",
  "COMMUNITY_FOLLOW",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const AUDIT_ACTIONS = [
  "AUTH_LOGIN",
  "AUTH_LOGOUT",
  "AUTH_LOGOUT_ALL",
  "AUTH_PASSWORD_CHANGED",
  "AUTH_PASSWORD_RESET_REQUESTED",
  "SECURITY_SETTINGS_CHANGED",
  "SESSION_REVOKED",
  "CONNECTION_CREATED",
  "CONNECTION_CODE_REGENERATED",
  "CONNECTION_CLAIMED",
  "CONNECTION_AUTHENTICATED",
  "CONNECTION_DISCONNECTED",
  "CONNECTION_REMOVED",
  "BOT_CREATED",
  "BOT_UPDATED",
  "BOT_STATE_CHANGED",
  "BOT_DELETED",
  "COMMUNITY_POST_DELETED",
  "COMMUNITY_REPORT_CREATED",
  "ACCOUNT_DELETION_REQUESTED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Connection-code lifetime. Short by design — the EA claims it immediately. */
export const CONNECTION_CODE_TTL_MINUTES = 15;

/** How long a Bridge session token stays valid before the EA must re-register. */
export const BRIDGE_TOKEN_TTL_SECONDS = 60 * 60 * 12;

/** A connection is considered offline when no heartbeat arrives in this window. */
export const BRIDGE_HEARTBEAT_TIMEOUT_SECONDS = 90;
