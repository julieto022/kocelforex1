import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getAccountMarketSymbols,
  getMarketHistorySync as readMarketHistorySync,
  requestMarketHistorySync,
} from "@/lib/server/market-history.server";

const connectionId = z.string().uuid();

export const getMarketSymbols = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ connectionId }).parse(data))
  .handler(({ data, context }) => getAccountMarketSymbols(context.userId, data.connectionId));

export const requestMarketHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        connectionId,
        symbol: z.string().trim().min(1).max(64),
        timeframe: z.enum(["M1", "M5", "M15", "M30", "H1", "H4", "D1"]),
        startAt: z.string().datetime(),
        endAt: z.string().datetime(),
      })
      .parse(data),
  )
  .handler(({ data, context }) => requestMarketHistorySync({ ...data, userId: context.userId }));

export const getMarketHistorySync = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ connectionId, requestId: z.string().uuid() }).parse(data),
  )
  .handler(({ data, context }) =>
    readMarketHistorySync(context.userId, data.connectionId, data.requestId),
  );
