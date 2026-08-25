/**
 * Canonical realtime event names. Phase 2 only defines the contract; the
 * WebSocket transport itself is built in Phase 4.
 */
export const KOCEL_EVENTS = {
  bridgeConnected: "bridge.connected",
  bridgeDisconnected: "bridge.disconnected",
  bridgeHeartbeat: "bridge.heartbeat",
  accountUpdated: "account.updated",
  marketTick: "market.tick",
  marketCandle: "market.candle",
  tradeOpened: "trade.opened",
  tradeClosed: "trade.closed",
  botUpdated: "bot.updated",
  signalCreated: "signal.created",
  notificationCreated: "notification.created",
} as const;

export type KocelEventName = (typeof KOCEL_EVENTS)[keyof typeof KOCEL_EVENTS];

export type KocelEvent<TPayload = unknown> = {
  event: KocelEventName;
  userId: string;
  brokerConnectionId?: string | null;
  emittedAt: string;
  payload: TPayload;
};
