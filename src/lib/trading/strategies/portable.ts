import { z } from "zod";

import { getStrategyDefinition } from "@/lib/trading/strategies/registry";
import { customRulesSchema } from "@/lib/trading/strategies/custom-rules";
import type { Strategy } from "@/services/types";

const portableSchema = z.object({
  format: z.literal("kocel-strategy"),
  schemaVersion: z.literal(1),
  name: z.string().trim().min(2).max(80),
  category: z.string().trim().min(1).max(60),
  description: z.string().max(4000),
  shortDescription: z.string().max(240),
  engine: z.string().trim().min(1).max(80),
  symbols: z.array(z.string().trim().min(1).max(64)).max(500),
  timeframes: z
    .array(z.enum(["M1", "M5", "M15", "M30", "H1", "H4", "D1"]))
    .min(1)
    .max(7),
  markets: z.array(z.string().trim().min(1).max(40)).max(20),
  configuration: z.record(z.string(), z.unknown()),
});

export type PortableStrategy = z.infer<typeof portableSchema>;

export function exportPortableStrategy(strategy: Strategy): PortableStrategy {
  const configuration = strategy.configuration ?? {};
  const timeframes = portableSchema.shape.timeframes.parse(strategy.timeframes ?? []);
  const engine =
    typeof configuration["runtimeStrategySlug"] === "string"
      ? configuration["runtimeStrategySlug"]
      : strategy.slug;
  return {
    format: "kocel-strategy",
    schemaVersion: 1,
    name: strategy.name,
    category: strategy.category,
    description: strategy.description,
    shortDescription: strategy.short_description,
    engine,
    symbols:
      Array.isArray(configuration["targetSymbols"]) &&
      configuration["targetSymbols"].every((symbol) => typeof symbol === "string")
        ? (configuration["targetSymbols"] as string[])
        : ["*"],
    timeframes,
    markets: strategy.markets ?? [],
    configuration: { ...configuration, runtimeStrategySlug: engine },
  };
}

export function parsePortableStrategy(value: unknown): PortableStrategy {
  const parsed = portableSchema.parse(value);
  if (!getStrategyDefinition(parsed.engine)) {
    throw new Error(`Unsupported strategy engine "${parsed.engine}".`);
  }
  if (
    parsed.engine === "custom-rules" &&
    !customRulesSchema.safeParse(parsed.configuration["customRules"]).success
  ) {
    throw new Error(
      "Custom-rules strategies must include a valid configuration.customRules object.",
    );
  }
  if (!parsed.symbols.length) throw new Error("Choose at least one symbol in the strategy JSON.");
  return parsed;
}
