import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getLiveNfpOutlook, getMarketNews } from "@/lib/server/market-intelligence.server";
import { enforceRateLimit } from "@/lib/server/rate-limit.server";

const newsFilters = z.object({
  search: z.string().trim().max(80).optional(),
  category: z.string().max(40).optional(),
  currency: z.string().max(8).optional(),
  impact: z.enum(["all", "high", "medium", "low"]).optional(),
  range: z.enum(["all", "today", "tomorrow", "week"]).optional(),
});

export const getMarketNewsFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => newsFilters.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    await enforceRateLimit("marketNews", context.userId);
    return getMarketNews(data);
  });

export const getNfpMarketOutlook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await enforceRateLimit("nfpOutlook", context.userId);
    return getLiveNfpOutlook();
  });
