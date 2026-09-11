import {
  createStrategy as createStrategyFn,
  deleteStrategy as deleteStrategyFn,
  duplicateStrategy as duplicateStrategyFn,
  exportStrategy as exportStrategyFn,
  getStrategy as getStrategyFn,
  getStrategies as getStrategiesFn,
  importStrategy as importStrategyFn,
  setStrategyStatus as setStrategyStatusFn,
  updateStrategy as updateStrategyFn,
} from "@/lib/functions/strategies.functions";
import type { Strategy } from "./types";

export type StrategyInput = {
  name: string;
  description?: string;
  category: string;
  subcategory?: string | null;
  strategyType?: "manual" | "algorithmic" | "hybrid";
  status?: "ACTIVE" | "INACTIVE" | "DRAFT" | "ARCHIVED";
  version?: string;
  configuration?: Record<string, unknown>;
};

export async function getStrategies(): Promise<Strategy[]> {
  const strategies = await getStrategiesFn();
  return (strategies ?? []) as Strategy[];
}

export async function getStrategy(id: string): Promise<Strategy | null> {
  const strategy = await getStrategyFn({ data: { strategyId: id } });
  return (strategy as unknown as Strategy) ?? null;
}

export async function createStrategy(input: StrategyInput): Promise<Strategy> {
  const strategy = await createStrategyFn({
    data: {
      name: input.name,
      description: input.description ?? "",
      category: input.category as never,
      subcategory: input.subcategory ?? undefined,
      strategyType: input.strategyType ?? "manual",
      status: input.status ?? "DRAFT",
      version: input.version ?? "1.0",
      configuration: input.configuration ?? {},
    },
  });
  return strategy as unknown as Strategy;
}

export async function updateStrategy(id: string, patch: Partial<StrategyInput>) {
  await updateStrategyFn({
    data: {
      strategyId: id,
      name: patch.name,
      description: patch.description,
      category: patch.category as never,
      subcategory: patch.subcategory ?? undefined,
      strategyType: patch.strategyType,
      status: patch.status,
      version: patch.version,
      configuration: patch.configuration,
    },
  });
}

export async function duplicateStrategy(id: string) {
  return (await duplicateStrategyFn({ data: { strategyId: id } })) as unknown as Strategy;
}

export async function deleteStrategy(id: string) {
  await deleteStrategyFn({ data: { strategyId: id } });
}

export async function setStrategyStatus(id: string, status: Strategy["status"]) {
  return setStrategyStatusFn({
    data: { strategyId: id, status: String(status).toUpperCase() as never },
  });
}

export async function importStrategy(json: string | Record<string, unknown>) {
  return importStrategyFn({
    data: { payload: typeof json === "string" ? json : JSON.stringify(json) },
  });
}

export async function exportStrategy(id: string) {
  return exportStrategyFn({ data: { strategyId: id } });
}
