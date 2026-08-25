/**
 * Broker and Bridge contracts.
 *
 * Kocel is broker-independent: it never holds MT5 credentials and never talks
 * to a broker server directly. A BrokerAdapter describes what a broker family
 * supports; a BridgeService describes the only channel through which account
 * data and orders move — the Kocel Bridge EA running inside the user's own
 * terminal.
 */

import type { ConnectionStatus, ConnectionEnvironment } from "@/lib/api/constants";

export type BrokerCapabilities = {
  forex: boolean;
  metals: boolean;
  indices: boolean;
  crypto: boolean;
  hedging: boolean;
  automatedTrading: boolean;
};

export type BrokerConnectionRequest = {
  accountName: string;
  mt5Login: string;
  server: string;
  environment: ConnectionEnvironment;
  accountType?: string | null;
};

export type BrokerValidationResult = { ok: true } | { ok: false; message: string };

export interface BrokerAdapter {
  readonly slug: string;
  readonly displayName: string;
  readonly capabilities: BrokerCapabilities;
  /** Server-name and login shape checks; purely local, no network calls. */
  validateConnectionRequest(request: BrokerConnectionRequest): BrokerValidationResult;
  /** Broker-specific setup guidance shown in the connection wizard. */
  setupInstructions(): string[];
}

/* --------------------------------------------------------------- Bridge */

export type BridgeIdentity = {
  connectionId: string;
  userId: string;
  mt5Login: string;
};

export type BridgeRegisterRequest = {
  code: string;
  mt5Login: string;
  server: string;
  eaVersion: string;
  terminalBuild?: string | null;
};

export type BridgeRegisterResult = {
  token: string;
  expiresAt: string;
  heartbeatSeconds: number;
};

export type BridgeAccountSnapshot = {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number | null;
  currency: string;
  leverage: number | null;
};

export type BridgeHeartbeat = {
  status: Extract<ConnectionStatus, "CONNECTED" | "ERROR">;
  account?: BridgeAccountSnapshot;
  openTrades?: number;
  message?: string | null;
};

export type BridgeStatus = {
  connectionId: string;
  status: ConnectionStatus;
  lastSeenAt: string | null;
  online: boolean;
};

/**
 * The full Bridge contract. The HTTP routes under /api/public/bridge/* are the
 * transport; this interface is the behaviour they implement.
 */
export interface BridgeService {
  register(request: BridgeRegisterRequest): Promise<BridgeRegisterResult>;
  authenticate(token: string): Promise<BridgeIdentity | null>;
  heartbeat(identity: BridgeIdentity, payload: BridgeHeartbeat): Promise<BridgeStatus>;
  disconnect(identity: BridgeIdentity, reason?: string): Promise<void>;
  status(identity: BridgeIdentity): Promise<BridgeStatus>;
}
