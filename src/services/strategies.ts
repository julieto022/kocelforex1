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
    throw new StrategyServiceError("SUPABASE_CONNECTION_ERROR", "Unable to verify your session.", sessionError);
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
      "id,name,slug,description,short_description,category,is_active,status,timeframes,markets,configuration,created_at,updated_at",
    )
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    const code = classifySupabaseError(error);
    logStrategyError(error, code);
    throw new StrategyServiceError(code, "The strategy library could not be loaded.", error);
  }

  console.info("[Strategies] Query succeeded", { count: data?.length ?? 0 });
  return (data ?? []) as Strategy[];
}
