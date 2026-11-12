import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createMcpStrategy,
  deleteMcpStrategy,
  updateMcpStrategy,
} from "@/lib/server/mcp-management.server";

const strategyId = z.string().uuid();
const engineSlug = z.string().trim().min(1).max(80);
const targetSymbols = z.array(z.string().trim().min(1).max(64)).max(500);
const timeframes = z.array(z.enum(["M1", "M5", "M15", "M30", "H1", "H4", "D1"])).max(7);
const markets = z.array(z.string().trim().min(1).max(40)).max(20);

export const createStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(80),
        category: z.string().trim().min(1).max(60),
        description: z.string().max(4000),
        shortDescription: z.string().max(240),
        engineSlug,
        targetSymbols,
        timeframes,
        markets,
      })
      .parse(data),
  )
  .handler(({ data, context }) =>
    createMcpStrategy(context.userId, {
      ...data,
      configuration: { targetSymbols: data.targetSymbols },
    }),
  );

export const updateStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        strategyId,
        name: z.string().trim().min(2).max(80).optional(),
        category: z.string().trim().min(1).max(60).optional(),
        description: z.string().max(4000).optional(),
        shortDescription: z.string().max(240).optional(),
        engineSlug: engineSlug.optional(),
        targetSymbols: targetSymbols.optional(),
        timeframes: timeframes.optional(),
        markets: markets.optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).some((key) => key !== "strategyId"), {
        message: "Provide at least one strategy field to update.",
      })
      .parse(data),
  )
  .handler(({ data, context }) => {
    const {
      strategyId: id,
      targetSymbols: symbols,
      timeframes: frames,
      markets: classes,
      ...patch
    } = data;
    const configuration: Record<string, unknown> = {};
    if (symbols !== undefined) configuration["targetSymbols"] = symbols;
    const strategyPatch = {
      ...patch,
      ...(frames !== undefined ? { timeframes: frames } : {}),
      ...(classes !== undefined ? { markets: classes } : {}),
      ...(Object.keys(configuration).length ? { configuration } : {}),
    };
    return updateMcpStrategy(context.userId, id, {
      ...strategyPatch,
    });
  });

export const deleteStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ strategyId }).parse(data))
  .handler(({ data, context }) => deleteMcpStrategy(context.userId, data.strategyId));
