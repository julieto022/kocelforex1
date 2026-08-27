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
```

- **UI/routes** — `src/routes`. Authenticated pages live under `_app.*`.
- **Client services** — `src/services/*`. Thin wrappers used by pages; reads go
  straight to Postgres under RLS, writes go through server functions.
- **Server functions** — `src/lib/functions/*.functions.ts`. Authenticated with
  `requireSupabaseAuth`; the handler receives `{ supabase, userId, claims }`.
- **Server-only helpers** — `src/lib/server/*.server.ts` (crypto, bridge,
  ownership, rate limiting, notifications). Never imported by client code.
- **Public HTTP** — `src/routes/api/public/*`. Bridge contract and health only.
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

`docs/openapi.yaml` freezes the public Bridge contract as **Bridge API Version 1.0**.
Application features use typed server functions, not HTTP endpoints. Changes to the Bridge
wire contract require a new API version.
