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
  return internal();
}
