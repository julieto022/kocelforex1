import { ERROR_CODES, type ErrorCode } from "./response";

/**
 * The only error type Kocel server logic throws outward. It carries a stable
 * machine code and a human message that is always safe to show a user —
 * database text and stack traces never reach the client.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_CODES[code];
  }
}

export const unauthenticated = (message = "You need to sign in to continue.") =>
  new ApiError("UNAUTHENTICATED", message);

export const forbidden = (message = "You do not have access to this resource.") =>
  new ApiError("FORBIDDEN", message);

export const notFound = (message = "We couldn't find that resource.") =>
  new ApiError("NOT_FOUND", message);

export const invalid = (message: string) => new ApiError("VALIDATION_ERROR", message);

export const conflict = (message: string) => new ApiError("CONFLICT", message);

export const rateLimited = (message = "Too many requests. Please try again shortly.") =>
  new ApiError("RATE_LIMITED", message);

export const internal = (message = "Something went wrong on our side.") =>
  new ApiError("INTERNAL_ERROR", message);

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Maps any thrown value to a client-safe ApiError. */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;

  const databaseError = error as { code?: string; message?: string } | null;
  const code = (databaseError?.code ?? "").toUpperCase();
  const message = (databaseError?.message ?? "").toLowerCase();

  if (
    ["PGRST301", "PGRST302", "PGRST303", "401"].includes(code) ||
    message.includes("jwt expired") ||
    message.includes("token expired") ||
    message.includes("invalid token") ||
    message.includes("unauthorized") ||
    message.includes("permission denied for table \"user_settings\"")
  ) {
    return unauthenticated("Your session has expired. Please sign in again.");
  }

  if (
    code === "42501" ||
    message.includes("permission denied") ||
    message.includes("row level security") ||
    message.includes("rls")
  ) {
    return forbidden("You do not have permission to access these Settings.");
  }

  if (
    code === "23505" ||
    message.includes("duplicate") ||
    message.includes("already exists")
  ) {
    return conflict("These settings already exist. Please try saving again.");
  }

  if (code === "23514" || message.includes("outside the allowed range")) {
    return invalid("Some Settings values are invalid. Please review them.");
  }

  if (
    ["42P01", "PGRST205", "PGRST204", "42703"].includes(code) ||
    message.includes("does not exist") ||
    message.includes("schema")
  ) {
    if (
      message.includes("trading_risk_settings") ||
      message.includes("table \"trading_risk_settings\"") ||
      message.includes("relation \"trading_risk_settings\"")
    ) {
      return internal(
        "The Trading Risk Settings table is missing or not migrated yet. Please apply the Supabase migration for trading_risk_settings.",
      );
    }

    if (
      message.includes("user_settings") ||
      message.includes("table \"user_settings\"") ||
      message.includes("relation \"user_settings\"")
    ) {
      return internal(
        "The user_settings table is missing or not migrated yet. Please apply the Supabase migration for user_settings.",
      );
    }

    return internal("The Settings database schema is missing or out of date. Please apply the required Supabase migrations.");
  }

  if (
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("timeout") ||
    message.includes("service unavailable") ||
    message.includes("failed to fetch")
  ) {
    return internal("Unable to load Settings right now. Please try again.");
  }

  return internal("Something went wrong while loading your Settings.");
}
