# Kocel Forex Hub — Developer Guide

Kocel is a broker-independent MT5 automation and market-intelligence platform.
The platform never asks for, stores, or transmits MT5 passwords or investor
credentials. A user installs the **Kocel Bridge EA** in their own terminal, and
the EA requests browser authorization before receiving a short-lived, revocable Bridge session.

## Architecture

```text
Browser (React + TanStack Router)
  |  typed RPC (createServerFn, bearer token attached automatically)
  v
Server functions  ──►  Postgres (RLS, owner-scoped policies)
  ^
  |  HTTP + authorization poll token / bridge token (HMAC signed)
Kocel Bridge EA (user's MetaTrader 5 terminal)
AI client (MCP Streamable HTTP + per-account bearer key)
```

- **UI/routes** — `src/routes`. Authenticated pages live under `_app.*`.
- **Client services** — `src/services/*`. Thin wrappers used by pages; reads go
  straight to Postgres under RLS, writes go through server functions.
- **Server functions** — `src/lib/functions/*.functions.ts`. Authenticated with
  `requireSupabaseAuth`; the handler receives `{ supabase, userId, claims }`.
- **Server-only helpers** — `src/lib/server/*.server.ts` (crypto, bridge,
  ownership, rate limiting, notifications). Never imported by client code.
- **Public HTTP** — `src/routes/api/public/*` for the Bridge contract and
  `src/routes/api/mcp.ts` for authenticated MCP requests.
- **Contracts** — `src/lib/contracts/*` define provider and broker interfaces so
  data sources (news, calendar, NFP, market data, signals) can be swapped.

The connection flow is `MT5 → EA → Browser Authorization → Kocel → Secure Bridge Session`.
The EA calls `register` with terminal identity, opens the returned authorization URL, and polls
`authenticate` with its opaque poll token. After the signed-in user approves the request, the
endpoint returns the Bridge token. Kocel never receives the broker password.

## Connection lifecycle

1. Bridge EA calls `POST /api/public/bridge/register` with MT5 login, broker, server, and EA metadata.
2. Server creates a short-lived authorization request and returns a browser URL plus an opaque poll token.
3. The signed-in user reviews the masked MT5 identity and approves or rejects it.
4. The EA polls `POST /api/public/bridge/authenticate`; approval returns a signed Bridge token.
5. EA sends heartbeats; missed heartbeats make the connection offline.
6. Disconnecting or revoking invalidates the connection before removal — it never
   closes or modifies MT5 positions.

## Security model

- Every user-facing table has RLS scoped to `auth.uid()`.
- `rate_limits` has RLS enabled with **no policies** by design: it is a
  server-only counter table written through a `SECURITY DEFINER` function.
- Authorization poll tokens and session tokens are stored hashed with
  `CONNECTION_CODE_PEPPER`; Bridge tokens are signed with `BRIDGE_TOKEN_SECRET` and checked
  against the connection's revocation state.
- MCP keys are scoped to one owned MT5 connection, stored only as one-way hashes,
  rate-limited per key, and revocable from `/mcp`. Direct trading is an explicit per-key
  capability; commands still pass the account's risk checks, Bridge freshness checks, and EA
  validation. Bot, strategy, and backtest tools are restricted to the key owner's account data.
- Automated bots are claimed by the authenticated `/api/cron/bots` worker. Each scheduled run
  stores its analysis, skips stale or repeated signals, and queues trades only when both stop-loss
  and take-profit levels are valid. Orders still pass the normal account risk checks and are not
  confirmed as executed until the connected Bridge EA reports the result.
- Built-in strategies are shared and cannot be changed globally by an MCP client. Rename, edit,
  or hide operations create private owner-specific overrides; custom strategies are owner-scoped.
- Backtests replay historical OHLC candles received from the MT5 Bridge EA. They use next-candle
  entries, risk-based simulated sizing, supplied spread/slippage, and conservative stop-first
  handling when a candle touches both stop and target. They do not model broker contract sizes,
  commission, swaps, gaps, or execution latency.
- Sensitive fields are redacted by `src/lib/api/logger.ts` before logging.

## Environment

See `.env.example`. Server-only values are read inside handlers via
`process.env['NAME']`; browser values use `import.meta.env.VITE_*`.

## Testing

```bash
npm test
npm run lint
npm run build
npm run test:integration
```

Unit tests cover authorization token hashing, Bridge token signing and expiry,
the API envelope, log redaction, and environment-gated Bridge registration/polling integration.
`test:integration` requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PUBLIC_APP_URL`; it
must be run against a disposable test project because it creates and deletes authorization rows.

## API reference

`docs/openapi.yaml` freezes the Bridge contract as **Bridge API Version 1.0**.
The MCP Streamable HTTP endpoint is separate at `/api/mcp`. Sign in to Kocel and visit
`/mcp` to create a per-account bearer key and copy the MCP client configuration. The key
is displayed only once. The endpoint exposes account/position/order reads, direct trade execution
when explicitly enabled on that key, account-scoped bot and strategy management, and saved
backtest management. `execute_trade` queues a command without per-trade site approval, requires a
stable `clientRequestId` for retry idempotency, and returns a pending status until the Bridge EA
reports the actual result.

Apply `supabase/migrations/20261111185000_mcp_ai_feature.sql` and
`supabase/migrations/20261112100000_mcp_management_and_backtesting.sql` to the connected
Supabase project before deploying the expanded MCP and backtest features. The endpoint uses
stateless JSON-RPC POST requests; the page's AI activity indicator reflects authenticated MCP
requests received in the prior two minutes, not a persistent transport session.

For scheduled bot execution, apply
`supabase/migrations/20261113130000_bot_automation_schedule.sql` and set a strong
`CRON_SECRET` environment variable in Vercel. Vercel Hobby permits only daily cron jobs, so
`.github/workflows/bot-automation.yml` calls the protected worker every five minutes instead.
In GitHub repository **Settings → Secrets and variables → Actions**, add a `CRON_SECRET` secret
with the same value as Vercel's, then add the `BOT_SCHEDULER_ENABLED` variable with value `true`.
GitHub may delay scheduled workflow starts during periods of high load. Each bot's configured
interval determines its individual cadence. A bot must be started by the user or an MCP key with
direct-trading permission, and its MT5 Bridge must be online for queued orders to reach the terminal.

The MCP server supports bulk creation and clearing for bots and strategies. Creating a bot leaves
it stopped; starting it schedules analysis and execution using its configured interval and lot size.
`clear_bots` removes bot definitions only and does not close open MT5 positions.
