import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { invalid, notFound, toApiError } from "@/lib/api/errors";

const riskSettingsSchema = z.object({
  connectionId: z.string().uuid(),
  maxLotSize: z.number().positive().max(1000).optional(),
  maxOpenPositions: z.number().int().positive().max(10000).optional(),
  maxPositionsPerSymbol: z.number().int().positive().max(1000).optional(),
  maxDailyLoss: z.number().nonnegative().nullable().optional(),
  maxDailyLossPercent: z.number().min(0).max(100).nullable().optional(),
  maxTradeRiskPercent: z.number().min(0).max(100).nullable().optional(),
  minimumFreeMargin: z.number().nonnegative().optional(),
  maximumMarginUsagePercent: z.number().min(0).max(100).optional(),
  requireStopLoss: z.boolean().optional(),
  manualTradingEnabled: z.boolean().optional(),
  emergencyStopEnabled: z.boolean().optional(),
});

export const getRiskSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ connectionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: connection } = await supabase
      .from("broker_connections")
      .select("id")
      .eq("id", data.connectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!connection) throw notFound("MT5 connection not found.");

    const { data: settings, error } = await supabase
      .from("trading_risk_settings")
      .select("*")
      .eq("connection_id", data.connectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw toApiError(error);
    return settings;
  });

export const updateRiskSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => riskSettingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: connection } = await supabase
      .from("broker_connections")
      .select("id")
      .eq("id", data.connectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!connection) throw notFound("MT5 connection not found.");

    const patch = {
      user_id: userId,
      connection_id: data.connectionId,
      ...(data.maxLotSize !== undefined ? { max_lot_size: data.maxLotSize } : {}),
      ...(data.maxOpenPositions !== undefined ? { max_open_positions: data.maxOpenPositions } : {}),
      ...(data.maxPositionsPerSymbol !== undefined
        ? { max_positions_per_symbol: data.maxPositionsPerSymbol }
        : {}),
      ...(data.maxDailyLoss !== undefined ? { max_daily_loss: data.maxDailyLoss } : {}),
      ...(data.maxDailyLossPercent !== undefined
        ? { max_daily_loss_percent: data.maxDailyLossPercent }
        : {}),
      ...(data.maxTradeRiskPercent !== undefined
        ? { max_trade_risk_percent: data.maxTradeRiskPercent }
        : {}),
      ...(data.minimumFreeMargin !== undefined ? { minimum_free_margin: data.minimumFreeMargin } : {}),
      ...(data.maximumMarginUsagePercent !== undefined
        ? { maximum_margin_usage_percent: data.maximumMarginUsagePercent }
        : {}),
      ...(data.requireStopLoss !== undefined ? { require_stop_loss: data.requireStopLoss } : {}),
      ...(data.manualTradingEnabled !== undefined
        ? { manual_trading_enabled: data.manualTradingEnabled }
        : {}),
      ...(data.emergencyStopEnabled !== undefined
        ? { emergency_stop_enabled: data.emergencyStopEnabled }
        : {}),
    };

    const { error } = await supabase
      .from("trading_risk_settings")
      .upsert(patch, { onConflict: "user_id,connection_id" });
    if (error) {
      if (error.code === "23514") throw invalid("One or more risk limits are outside the allowed range.");
      throw toApiError(error);
    }
    return { ok: true as const };
  });
