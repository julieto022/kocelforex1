import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { analyzeBotForUser } from "@/lib/functions/analysis.functions";
import { isTradableAutomationSignal } from "@/lib/trading/automation";
import type { TradingSignal } from "@/lib/trading/signals/types";
import { logger } from "@/lib/api/logger";
import { executeTradeCommand } from "@/lib/server/trade.server";

const CLAIM_LIMIT = 5;

async function updateRun(
  db: SupabaseClient<Database>,
  runId: string,
  update: Database["public"]["Tables"]["bot_automation_runs"]["Update"],
) {
  const { error } = await db.from("bot_automation_runs").update(update).eq("id", runId);
  if (error) throw error;
}

async function processRun(
  db: SupabaseClient<Database>,
  run: Database["public"]["Tables"]["bot_automation_runs"]["Row"],
) {
  try {
    const signal = await analyzeBotForUser(db, run.user_id, run.bot_id);
    if (!isTradableAutomationSignal(signal)) {
      await updateRun(db, run.id, {
        status: "SKIPPED",
        direction:
          signal.direction === "BUY" || signal.direction === "SELL" ? signal.direction : null,
        reason:
          signal.dataStatus !== "FRESH"
            ? signal.reason
            : signal.direction !== "BUY" && signal.direction !== "SELL"
              ? signal.reason || "NO_TRADE_SIGNAL"
              : "SIGNAL_MISSING_VALID_STOP_LOSS_OR_TAKE_PROFIT",
        signal: signal as never,
        completed_at: new Date().toISOString(),
      });
      return { runId: run.id, status: "SKIPPED" };
    }

    const { data: bot, error: botError } = await db
      .from("bots")
      .select("automation_lot_size")
      .eq("id", run.bot_id)
      .eq("user_id", run.user_id)
      .maybeSingle();
    if (botError) throw botError;
    if (!bot) throw new Error("Bot was deleted before its scheduled run.");

    const { data: recentRuns, error: recentError } = await db
      .from("bot_automation_runs")
      .select("signal")
      .eq("bot_id", run.bot_id)
      .eq("status", "QUEUED")
      .order("created_at", { ascending: false })
      .limit(100);
    if (recentError) throw recentError;

    const repeatedSignal = (recentRuns ?? []).some((previous) => {
      if (
        !previous.signal ||
        typeof previous.signal !== "object" ||
        Array.isArray(previous.signal)
      ) {
        return false;
      }
      return previous.signal["dataTimestamp"] === signal.dataTimestamp;
    });
    if (repeatedSignal) {
      await updateRun(db, run.id, {
        status: "SKIPPED",
        direction: signal.direction,
        reason: "SIGNAL_ALREADY_TRADED_FOR_THIS_MARKET_DATA",
        signal: signal as never,
        completed_at: new Date().toISOString(),
      });
      return { runId: run.id, status: "SKIPPED" };
    }

    const result = await executeTradeCommand(run.user_id, {
      connectionId: run.connection_id,
      operation: "OPEN_MARKET",
      symbol: signal.resolvedSymbol ?? signal.symbol,
      side: signal.direction,
      volume: bot.automation_lot_size,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      clientRequestId: crypto.randomUUID(),
    });
    const status = result.status === "PENDING" ? "QUEUED" : "REJECTED";
    await updateRun(db, run.id, {
      status,
      direction: signal.direction,
      reason: result.message ?? result.errorCode ?? null,
      signal: signal as never,
      command_id: result.status === "PENDING" ? result.commandId : null,
      completed_at: new Date().toISOString(),
    });
    return { runId: run.id, status, commandId: result.commandId };
  } catch (error) {
    logger.error("system", "Scheduled bot run failed", {
      runId: run.id,
      botId: run.bot_id,
      userId: run.user_id,
      error,
    });
    await updateRun(db, run.id, {
      status: "FAILED",
      reason: "SCHEDULED_RUN_FAILED",
      completed_at: new Date().toISOString(),
    });
    return { runId: run.id, status: "FAILED" };
  }
}

async function runScheduledBots(request: Request): Promise<Response> {
  const authResponse = await authenticateCronRequest(request);
  if (authResponse) return authResponse;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: staleRuns, error: staleError } = await supabaseAdmin
    .from("bot_automation_runs")
    .update({
      status: "FAILED",
      reason: "SCHEDULED_RUN_TIMED_OUT",
      completed_at: new Date().toISOString(),
    })
    .eq("status", "RUNNING")
    .lt("created_at", new Date(Date.now() - 15 * 60_000).toISOString())
    .select("id");
  if (staleError) {
    logger.error("database", "Unable to expire stale bot automation runs", { error: staleError });
    return Response.json({ error: "Could not prepare scheduled bot runs." }, { status: 500 });
  }

  const { data: runs, error: claimError } = await supabaseAdmin.rpc(
    "claim_due_bot_automation_runs",
    { p_limit: CLAIM_LIMIT },
  );
  if (claimError) {
    logger.error("database", "Unable to claim scheduled bot runs", { error: claimError });
    return Response.json({ error: "Could not claim scheduled bot runs." }, { status: 500 });
  }

  const results: Array<{ runId: string; status: string; commandId?: string }> = [];
  for (const run of runs ?? []) {
    results.push(await processRun(supabaseAdmin, run));
  }
  return Response.json({
    claimed: runs?.length ?? 0,
    expired: staleRuns?.length ?? 0,
    results,
  });
}

export const Route = createFileRoute("/api/cron/bots")({
  server: {
    handlers: {
      GET: async ({ request }) => runScheduledBots(request),
    },
  },
});
