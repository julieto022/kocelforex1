import { supabase } from "@/integrations/supabase/client";
import type { Strategy } from "./types";

export type StrategyErrorCode =
  | "AUTH_REQUIRED"
  | "SUPABASE_CONNECTION_ERROR"
  | "TABLE_NOT_FOUND"
  | "COLUMN_NOT_FOUND"
  | "RLS_DENIED"
  | "API_ERROR"
  | "UNKNOWN_ERROR";

export class StrategyServiceError extends Error {
  readonly code: StrategyErrorCode;
  override readonly cause: unknown;

  constructor(code: StrategyErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "StrategyServiceError";
    this.code = code;
    this.cause = cause;
  }
}

function classifySupabaseError(error: { code?: string; message?: string; status?: number }) {
  const message = error.message?.toLowerCase() ?? "";
  if (error.code === "PGRST205" || message.includes("could not find the table")) {
    return "TABLE_NOT_FOUND" as const;
  }
  if (error.code === "PGRST204" || message.includes("column")) {
    return "COLUMN_NOT_FOUND" as const;
  }
  if (error.status === 401 || error.status === 403 || error.code === "42501") {
    return "RLS_DENIED" as const;
  }
  if (!error.status) return "SUPABASE_CONNECTION_ERROR" as const;
  return "API_ERROR" as const;
}

function logStrategyError(error: unknown, code: StrategyErrorCode) {
  const safeError = error as { code?: string; message?: string; details?: string; hint?: string };
  console.error("[Strategies] Query failed", {
    code,
    supabaseCode: safeError.code,
    message: safeError.message,
    details: safeError.details,
    hint: safeError.hint,
  });
}

export async function getStrategies(): Promise<Strategy[]> {
  console.info("[Strategies] Fetch started");
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    logStrategyError(sessionError, "SUPABASE_CONNECTION_ERROR");
    throw new StrategyServiceError(
      "SUPABASE_CONNECTION_ERROR",
      "Unable to verify your session.",
      sessionError,
    );
  }
  if (!sessionData.session) {
    console.warn("[Strategies] Authenticated: false");
    throw new StrategyServiceError("AUTH_REQUIRED", "Sign in to view the strategy library.");
  }

  console.info("[Strategies] Authenticated: true");
  console.info("[Strategies] Query started");
  const { data, error } = await supabase
    .from("strategies")
    .select(
      "id,name,slug,description,short_description,category,is_active,is_builtin,user_id,status,timeframes,markets,configuration,created_at,updated_at",
    )
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    const code = classifySupabaseError(error);
    logStrategyError(error, code);
    throw new StrategyServiceError(code, "The strategy library could not be loaded.", error);
  }

  const strategyRows = data ?? [];
  let overrideById = new Map<
    string,
    {
      name_override: string | null;
      description_override: string | null;
      short_description_override: string | null;
      category_override: string | null;
      configuration_override: (typeof strategyRows)[number]["configuration"] | null;
      is_hidden: boolean;
    }
  >();
  if (strategyRows.length > 0) {
    const { data: overrides, error: overrideError } = await supabase
      .from("strategy_user_overrides")
      .select(
        "strategy_id,name_override,description_override,short_description_override,category_override,configuration_override,is_hidden",
      )
      .eq("user_id", sessionData.session.user.id)
      .in(
        "strategy_id",
        strategyRows.map((strategy) => strategy.id),
      );
    if (overrideError) {
      const code = classifySupabaseError(overrideError);
      logStrategyError(overrideError, code);
      throw new StrategyServiceError(
        code,
        "Your strategy preferences could not be loaded.",
        overrideError,
      );
    }
    overrideById = new Map((overrides ?? []).map((override) => [override.strategy_id, override]));
  }
  const effectiveStrategies = strategyRows
    .map((strategy) => {
      const override = overrideById.get(strategy.id);
      return {
        ...strategy,
        name: override?.name_override ?? strategy.name,
        description: override?.description_override ?? strategy.description,
        short_description: override?.short_description_override ?? strategy.short_description,
        category: override?.category_override ?? strategy.category,
        configuration: override?.configuration_override ?? strategy.configuration,
        is_hidden: override?.is_hidden ?? false,
      };
    })
    .filter((strategy) => !strategy.is_hidden);
  console.info("[Strategies] Query succeeded", { count: effectiveStrategies.length });
  return effectiveStrategies as Strategy[];
}
