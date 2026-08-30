# Phase 2 — Real Backend, Database & API Layer

Phase 1 UI, navigation, design system and all modules stay exactly as they are. This phase only adds/strengthens what sits behind them.

## One important adaptation

Phase 2 asks for a standalone `/backend` Express + Postgres server. This app runs on TanStack Start on a serverless edge runtime — a long-running Express process can't be hosted here. The equivalent, already-supported architecture is used instead, and it satisfies every Phase 2 success criterion:

| Phase 2 asks for               | Built as                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Express controllers/routes     | Typed server functions (`createServerFn`) + HTTP routes under `src/routes/api/` for external callers (Bridge, cron, health) |
| Services / repositories        | `src/services/*` (client) + `src/lib/*.functions.ts` and `*.server.ts` (server logic)                                       |
| Postgres + migrations          | Lovable Cloud Postgres with versioned migrations                                                                            |
| JWT auth + sessions            | Managed auth: Argon2-class password hashing, refresh rotation, HTTP-only session storage — never broker credentials         |
| requireAuth / requireOwnership | Auth middleware on server functions + row-level ownership rules enforced in the database itself                             |
| Rate limiting                  | Server-side counters table + per-endpoint limits                                                                            |

Users never touch the database directly; every write goes through authenticated, validated server logic.

## 1. Database upgrade (migrations)

Extend the existing schema rather than recreating it. New tables:

- `user_sessions` — device, browser, IP metadata, last activity, expiry, revoked_at (powers Settings → Security "Active sessions" / "Log out all devices")
- `audit_logs` — user, action, entity type/id, IP metadata, user agent
- `market_symbols` — per broker connection: symbol, asset class, digits, point, contract size, volume min/max/step, trade mode, status
- `nfp_events` (release date/time, previous, forecast, actual, surprise, status) with `nfp_predictions` re-pointed at it
- `community_saves`, and `community_reports` extended with description + status lifecycle
- `rate_limits` — keyed counters with windows

Extended existing tables:

- `profiles`: status (ACTIVE/SUSPENDED/PENDING/DELETED), email_verified, two_factor_enabled, last_login_at, deleted_at (soft delete)
- `broker_connections`: connection_code_expires_at, last_connected_at, ea_version, code lifecycle status (CREATED → WAITING → CLAIMED → AUTHENTICATING → CONNECTED, plus EXPIRED/FAILED/CANCELLED), hashed connection code
- `brokers`: description, updated_at
- `bots`: timeframe, configuration jsonb, DRAFT/PAUSED/WAITING statuses
- `trades`: commission, swap, updated_at, full status set
- `strategies`: timeframes, configuration_schema, updated_at
- `signals`: valid_from, updated_at, full status set
- `news`/`economic_events`: source_url, country, category, symbols array
- `notifications`: entity_type, entity_id, read_at, full type set

Every new table gets grants, row-level security, ownership policies, indexes on the fields listed in the brief, and `updated_at` triggers. Non-owned reference tables (brokers, strategies, news, events, NFP) stay read-only to clients and writable only by server code.

Seed data: supported brokers (Deriv, Exness) and strategy metadata only. No fake balances, trades, prices, signals, NFP results or news.

## 2. Auth, sessions & security

- Registration, login, logout, refresh, "me", forgot/reset password, email verification — all validated server-side with Zod (frontend validation kept as UX only)
- Password reset: random, short-lived, single-use tokens; identical response whether or not the account exists
- Login: rate limited, failed-attempt protection, account-status check, session row created + audit log
- Session management server functions: list active sessions, revoke one, revoke all
- Existing login/register/forgot/reset screens keep their current markup — only their submit handlers move to the new validated endpoints

## 3. Ownership & authorization

Every user-owned resource (MT5 connections, bots, trades, signals, notifications, settings, posts) is fetched and mutated through authenticated server logic that verifies `resource.user_id === session user`. Guessing an ID returns not-found, never another user's data. Enforced twice: in the server function and by database policy.

## 4. MT5 connections & connection codes

- `POST` connection creates the record and a cryptographically secure code (`KCL-XXXX-XXXX`), stored hashed, with an expiry and single-use claim
- Code lifecycle transitions with validation; expired codes can be regenerated
- Disconnect removes the Kocel-side connection only, and the API/UI copy states explicitly that broker positions are untouched
- Default MT5 account stays in user settings and remains the dashboard/bots/trades context
- MT5 trading passwords are never requested or stored

## 5. Bridge contract (Phase 3-ready, EA not built)

Public HTTP routes under `src/routes/api/public/bridge/*`: register, authenticate, heartbeat, disconnect, status. Register claims a valid connection code and issues a short-lived signed bridge token; every later call requires that token plus a matching MT5 login — no trusting a raw user id. Heartbeats update `last_seen_at`/status and emit notifications on transitions.

## 6. Module data layers & API

Server-function modules for bots (incl. start/stop/pause state only), strategies, trades, markets, news, economic events, NFP, signals, community (posts, comments, nested replies, reactions, saves, follows with self-follow blocked, reports), notifications (list, unread count, mark read, mark all, delete), settings, users (profile + photo), and dashboard.

Dashboard returns `NOT_CONNECTED` and null/empty account figures until the Bridge exists. Where no provider exists yet, current empty states are preserved — no invented data.

## 7. Cross-cutting

- Uniform `{ success, data, message }` / `{ success, error: { code, message } }` shape on HTTP routes; typed results for server functions
- Centralized error mapping to correct HTTP codes; no stack traces or database errors leaked
- Structured logging of API/auth/connection errors, with passwords, tokens and credentials never logged
- Per-endpoint rate limits (auth, password reset, posts, comments, code generation, bridge, general)
- Transactions (database functions) for registration, connection creation and account deletion
- Account deletion foundation: soft delete + anonymization, trading records retained
- Provider interfaces for News, EconomicCalendar, NFP, MarketData, Signal; `BrokerAdapter` and `BridgeService` contracts defined without implementations
- Event-name constants for the future WebSocket layer (`bridge.*`, `market.*`, `trade.*`, `signal.*`, `notification.*`)
- `GET /api/public/health` — API + database status, environment, version, timestamp, nothing sensitive
- API documentation in an OpenAPI-compatible document plus a developer README covering env vars, migrations, seeds and local run
- Tests: auth flows, cross-user isolation (bots, connections), connection-code expiry/ownership, community rules, validation and rate limiting

## Explicitly out of scope

No Bridge EA, no live market-data engine, no strategy/bot execution, no order execution, no AI decisions, no fake live financial data, no Manual Trade, no split Auto/Manual bot modules, no broker-login authentication.

## Delivery order

1. Schema migrations + seeds
2. Auth, sessions, security, ownership middleware
3. MT5 connections + connection-code lifecycle
4. Bridge contract routes + health check
5. Module data layers wired to existing pages
6. Rate limiting, logging, error handling, docs, tests
