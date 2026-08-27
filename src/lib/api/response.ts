/**
 * Uniform API envelope shared by every Kocel HTTP route.
 * Server functions return typed DTOs directly; HTTP routes wrap them here.
 */

export type ApiSuccess<T> = {
  success: true;
  data: T;
  message: string;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export const ERROR_CODES = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  AUTHORIZATION_EXPIRED: 410,
  AUTHORIZATION_ALREADY_DECIDED: 409,
  AUTHORIZATION_REJECTED: 403,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
};

export function ok<T>(data: T, message = "Success", status = 200): Response {
  const body: ApiSuccess<T> = { success: true, data, message };
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function fail(code: ErrorCode, message: string, status?: number): Response {
  const body: ApiFailure = { success: false, error: { code, message } };
  return new Response(JSON.stringify(body), {
    status: status ?? ERROR_CODES[code],
    headers: JSON_HEADERS,
  });
}
