/**
 * Structured server logging with hard redaction.
 * Secrets, tokens, passwords and broker credentials must never reach the log.
 */

const REDACTED_KEYS = [
  "password",
  "password_hash",
  "passwordhash",
  "confirmpassword",
  "token",
  "access_token",
  "refresh_token",
  "bridge_token",
  "session_token",
  "session_token_hash",
  "poll_token_hash",
  "connection_code",
  "connection_code_hash",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "pepper",
  "mt5_password",
  "investor_password",
];

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[depth-limit]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.includes(key.toLowerCase()) ? "[redacted]" : redact(item, depth + 1);
    }
    return out;
  }
  return value;
}

export type LogScope =
  "auth" | "api" | "database" | "bridge" | "connection" | "community" | "system";

type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, scope: LogScope, message: string, context?: unknown) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(context === undefined ? {} : { context: redact(context) }),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (scope: LogScope, message: string, context?: unknown) =>
    emit("info", scope, message, context),
  warn: (scope: LogScope, message: string, context?: unknown) =>
    emit("warn", scope, message, context),
  error: (scope: LogScope, message: string, context?: unknown) =>
    emit("error", scope, message, context),
};

/** Exported for tests. */
export const __redact = redact;
