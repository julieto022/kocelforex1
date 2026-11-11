import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deleteBacktestRun as deleteRun,
  getBacktestCatalog as loadCatalog,
  getBacktestRun as loadRun,
  runBacktestForUser,
} from "@/lib/server/backtest.server";

const connectionSchema = z.object({ connectionId: z.string().uuid() });

const runSchema = z.object({
  connectionId: z.string().uuid(),
  strategyId: z.string().uuid(),
  symbol: z.string().trim().min(1).max(64),
  timeframe: z.enum(["M1", "M5", "M15", "M30", "H1", "H4", "D1"]),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  initialBalance: z.number().positive().max(100_000_000),
  riskPercent: z.number().min(0.1).max(5),
  spread: z.number().min(0).max(1_000),
  slippage: z.number().min(0).max(1_000),
});

export const getBacktestCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => connectionSchema.parse(data))
  .handler(({ data, context }) => loadCatalog(context.userId, data.connectionId));

export const runBacktest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => runSchema.parse(data))
  .handler(({ data, context }) =>
    runBacktestForUser({
      userId: context.userId,
      connectionId: data.connectionId,
      strategyId: data.strategyId,
      symbol: data.symbol,
      timeframe: data.timeframe,
      startAt: data.startAt,
      endAt: data.endAt,
      settings: {
        initialBalance: data.initialBalance,
        riskPercent: data.riskPercent,
        spread: data.spread,
        slippage: data.slippage,
      },
    }),
  );

export const getBacktestRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ connectionId: z.string().uuid(), runId: z.string().uuid() }).parse(data),
  )
  .handler(({ data, context }) => loadRun(context.userId, data.connectionId, data.runId));

export const deleteBacktestRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ connectionId: z.string().uuid(), runId: z.string().uuid() }).parse(data),
  )
  .handler(({ data, context }) => deleteRun(context.userId, data.connectionId, data.runId));
