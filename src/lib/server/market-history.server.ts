import { invalid, notFound } from "@/lib/api/errors";
import type { BridgeCandle, BridgeIdentity } from "@/lib/contracts/broker";
import { recordAudit } from "@/lib/server/audit.server";
import { isTradingTimeframe } from "@/lib/trading/market/types";

const BRIDGE_FRESHNESS_MS = 90_000;

export async function getAccountMarketSymbols(userId: string, connectionId: string) {
  const db = await admin();
  const { data: connection, error: connectionError } = await db
    .from("broker_connections")
    .select("id")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (connectionError) throw connectionError;
  if (!connection) throw notFound("The selected MT5 account was not found.");

  const { data, error } = await db
    .from("market_symbols")
    .select("symbol, asset_class, display_name, status")
    .eq("user_id", userId)
    .eq("broker_connection_id", connectionId)
    .eq("status", "enabled")
    .order("symbol", { ascending: true })
    .limit(5_000);
  if (error) throw error;
  return data ?? [];
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function requestMarketHistorySync(input: {
  userId: string;
  connectionId: string;
  symbol: string;
  timeframe: string;
  startAt: string;
  endAt: string;
}) {
  const db = await admin();
  const symbol = input.symbol.trim();
  if (!symbol || symbol.length > 64) throw invalid("The selected symbol is invalid.");
  if (!isTradingTimeframe(input.timeframe)) throw invalid("The selected timeframe is invalid.");
  const startMs = Date.parse(input.startAt);
  const endMs = Date.parse(input.endAt);
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    startMs >= endMs ||
    endMs > Date.now()
  ) {
    throw invalid("Choose a valid historical date range.");
  }

  const { data: connection, error: connectionError } = await db
    .from("broker_connections")
    .select("id, status, last_seen_at")
    .eq("id", input.connectionId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (connectionError) throw connectionError;
  if (!connection) throw notFound("The selected MT5 account was not found.");

  const { data: existingRequest, error: existingError } = await db
    .from("market_data_sync_requests")
    .select("id, status, symbol, timeframe, start_at, end_at, candle_count, error_message")
    .eq("user_id", input.userId)
    .eq("connection_id", input.connectionId)
    .eq("symbol", symbol)
    .eq("timeframe", input.timeframe)
    .eq("start_at", input.startAt)
    .eq("end_at", input.endAt)
    .in("status", ["PENDING", "SYNCING", "COMPLETED"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingRequest) return existingRequest;

  if (
    connection.status !== "CONNECTED" ||
    !connection.last_seen_at ||
    Date.now() - Date.parse(connection.last_seen_at) > BRIDGE_FRESHNESS_MS
  ) {
    throw invalid("Connect the MT5 Bridge EA before downloading historical candles.");
  }

  const { data: accountSymbol, error: symbolError } = await db
    .from("market_symbols")
    .select("symbol")
    .eq("user_id", input.userId)
    .eq("broker_connection_id", input.connectionId)
    .eq("symbol", symbol)
    .eq("status", "enabled")
    .maybeSingle();
  if (symbolError) throw symbolError;
  if (!accountSymbol) {
    throw notFound(
      "That symbol is not in this account's MT5 Market Watch. Refresh symbols in the EA.",
    );
  }

  const { data, error } = await db
    .from("market_data_sync_requests")
    .insert({
      user_id: input.userId,
      connection_id: input.connectionId,
      symbol,
      timeframe: input.timeframe,
      start_at: input.startAt,
      end_at: input.endAt,
    })
    .select("id, status, symbol, timeframe, start_at, end_at, candle_count, error_message")
    .single();
  if (error) throw error;
  await recordAudit({
    userId: input.userId,
    action: "MARKET_HISTORY_SYNC_REQUESTED",
    entityType: "market_data_sync_request",
    entityId: data.id,
  });
  return data;
}

export async function getMarketHistorySync(
  userId: string,
  connectionId: string,
  requestId: string,
) {
  const db = await admin();
  const { data, error } = await db
    .from("market_data_sync_requests")
    .select("id, status, symbol, timeframe, start_at, end_at, candle_count, error_message")
    .eq("id", requestId)
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("The history sync request was not found.");
  return data;
}

export async function claimMarketHistorySync(connectionId: string) {
  const db = await admin();
  const now = new Date();
  const { data: request, error: requestError } = await db
    .from("market_data_sync_requests")
    .select("id, status, lease_until, symbol, timeframe, start_at, end_at")
    .eq("connection_id", connectionId)
    .or(`status.eq.PENDING,and(status.eq.SYNCING,lease_until.lt.${now.toISOString()})`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!request) return [];

  let claim = db
    .from("market_data_sync_requests")
    .update({
      status: "SYNCING",
      lease_until: new Date(now.getTime() + 5 * 60_000).toISOString(),
      error_message: null,
    })
    .eq("id", request.id)
    .eq("connection_id", connectionId);
  if (request.status === "PENDING") {
    claim = claim.eq("status", "PENDING");
  } else if (request.status === "SYNCING" && request.lease_until) {
    claim = claim.eq("status", "SYNCING").eq("lease_until", request.lease_until);
  } else {
    throw new Error("The market history request has an invalid status or lease.");
  }
  const { data, error } = await claim
    .select("id, symbol, timeframe, start_at, end_at")
    .maybeSingle();
  if (error) throw error;
  return data
    ? [
        {
          id: data.id,
          symbol: data.symbol,
          timeframe: data.timeframe,
          startAt: data.start_at,
          endAt: data.end_at,
        },
      ]
    : [];
}

export async function receiveMarketHistoryChunk(
  identity: BridgeIdentity,
  input: {
    requestId: string;
    candles: BridgeCandle[];
    complete: boolean;
    errorMessage?: string | undefined;
  },
) {
  const db = await admin();
  const { data: sync, error: lookupError } = await db
    .from("market_data_sync_requests")
    .select("id, user_id, connection_id, symbol, timeframe, start_at, end_at, status, candle_count")
    .eq("id", input.requestId)
    .eq("connection_id", identity.connectionId)
    .eq("user_id", identity.userId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!sync) throw notFound("The history request does not belong to this MT5 connection.");
  if (sync.status === "COMPLETED" || sync.status === "FAILED") {
    return { status: sync.status, candleCount: sync.candle_count ?? 0 };
  }
  if (sync.status !== "SYNCING") throw invalid("This history request is no longer active.");

  if (input.errorMessage) {
    const { error } = await db
      .from("market_data_sync_requests")
      .update({
        status: "FAILED",
        error_message: input.errorMessage.slice(0, 300),
        lease_until: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", sync.id)
      .eq("status", "SYNCING");
    if (error) throw error;
    return { status: "FAILED", candleCount: 0 };
  }

  const startAt = Date.parse(sync.start_at);
  const endAt = Date.parse(sync.end_at);
  for (const candle of input.candles) {
    if (
      candle.symbol !== sync.symbol ||
      candle.timeframe !== sync.timeframe ||
      Date.parse(candle.timestamp) < startAt ||
      Date.parse(candle.timestamp) > endAt
    ) {
      throw invalid(
        "The EA returned candles outside the requested symbol, timeframe, or date range.",
      );
    }
  }

  if (input.candles.length) {
    const { error } = await db.from("market_candles").upsert(
      input.candles.map((candle) => ({
        user_id: identity.userId,
        broker_connection_id: identity.connectionId,
        symbol: candle.symbol,
        timeframe: candle.timeframe,
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume ?? null,
        source: "MT5_BRIDGE",
        received_at: new Date().toISOString(),
      })),
      { onConflict: "broker_connection_id,symbol,timeframe,timestamp" },
    );
    if (error) throw error;
  }

  if (!input.complete) {
    const { error } = await db
      .from("market_data_sync_requests")
      .update({ lease_until: new Date(Date.now() + 5 * 60_000).toISOString() })
      .eq("id", sync.id)
      .eq("status", "SYNCING");
    if (error) throw error;
    return { status: "SYNCING", candleCount: input.candles.length };
  }

  const { count, error: countError } = await db
    .from("market_candles")
    .select("timestamp", { count: "exact", head: true })
    .eq("user_id", identity.userId)
    .eq("broker_connection_id", identity.connectionId)
    .eq("symbol", sync.symbol)
    .eq("timeframe", sync.timeframe)
    .gte("timestamp", sync.start_at)
    .lte("timestamp", sync.end_at);
  if (countError) throw countError;
  const status = (count ?? 0) > 0 ? "COMPLETED" : "FAILED";
  const { error: updateError } = await db
    .from("market_data_sync_requests")
    .update({
      status,
      candle_count: count ?? 0,
      error_message: status === "FAILED" ? "MT5 returned no candles for that date range." : null,
      lease_until: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sync.id)
    .eq("status", "SYNCING");
  if (updateError) throw updateError;
  return { status, candleCount: count ?? 0 };
}
