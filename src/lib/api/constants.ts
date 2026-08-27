/** Shared enums for the Phase 2 data layer. */

export const ACCOUNT_STATUS = ["ACTIVE", "SUSPENDED", "PENDING", "DELETED"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUS)[number];

export const CONNECTION_ENVIRONMENTS = ["DEMO", "REAL"] as const;
export type ConnectionEnvironment = (typeof CONNECTION_ENVIRONMENTS)[number];

/**
 * Connection lifecycle under the authorization architecture: the EA asks, the
 * signed-in user approves in Kocel, then the bridge session runs.
 */
export const CONNECTION_STATUSES = [
  "NOT_CONNECTED",
  "AUTHORIZATION_REQUESTED",
  "WAITING_FOR_USER",
  "AUTHORIZED",
  "CONNECTED",
  "DISCONNECTED",
  "REJECTED",
  "REVOKED",
  "ERROR",
  "EXPIRED",
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/** Lifecycle of a single EA authorization request. */
export const AUTHORIZATION_REQUEST_STATES = [
  "AUTHORIZATION_REQUESTED",
  "WAITING_FOR_USER",
  "AUTHORIZED",
  "REJECTED",
  "EXPIRED",
  "REVOKED",
] as const;
export type AuthorizationRequestState = (typeof AUTHORIZATION_REQUEST_STATES)[number];

export const BOT_STATUSES = ["DRAFT", "STOPPED", "RUNNING", "PAUSED", "WAITING", "ERROR"] as const;
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
  "ACCOUNT_AUTHORIZATION_REQUESTED",
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
  "CONNECTION_AUTHORIZATION_REQUESTED",
  "CONNECTION_AUTHORIZED",
  "CONNECTION_REJECTED",
  "CONNECTION_AUTHENTICATED",
  "CONNECTION_DISCONNECTED",
  "CONNECTION_REVOKED",
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

/** How long an EA authorization request waits for the user's decision. */
export const AUTHORIZATION_REQUEST_TTL_MINUTES = 10;

/** How long a Bridge session token stays valid before the EA must re-authorize. */
export const BRIDGE_TOKEN_TTL_SECONDS = 60 * 60 * 12;

/** Maximum age of a server-side Bridge session record. */
export const BRIDGE_SESSION_TTL_SECONDS = BRIDGE_TOKEN_TTL_SECONDS;

/** A connection is considered offline when no heartbeat arrives in this window. */
export const BRIDGE_HEARTBEAT_TIMEOUT_SECONDS = 90;

/** How often the EA should poll while the user decides. */
export const BRIDGE_AUTHORIZATION_POLL_SECONDS = 5;
