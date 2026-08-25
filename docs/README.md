# Kocel Forex Hub — Developer Guide

Kocel is a broker-independent MT5 automation and market-intelligence platform.
The platform never asks for, stores, or transmits MT5 passwords or investor
credentials. A user installs the **Kocel Bridge EA** in their own terminal, and
the EA pairs with the platform using a single-use code.

## Architecture

```text
Browser (React + TanStack Router)
  |  typed RPC (createServerFn, bearer token attached automatically)
  v
Server functions  ──►  Postgres (RLS, owner-scoped policies)
  ^
  |  HTTP + bridge token (HMAC signed)
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

## Connection lifecycle

1. User creates a connection → server generates `KCL-XXXX-XXXX`, stores only a
   peppered SHA-256 hash plus a short expiry, state `WAITING`.
2. Bridge EA calls `POST /api/public/bridge/register` with the code.
3. Server verifies the hash, marks the code `CLAIMED`, clears the plaintext, and
   returns a signed bridge token.
4. EA sends heartbeats; missed heartbeats age the connection to `STALE`.
5. Disconnecting removes the account from the Kocel workspace only — it never
   closes or modifies MT5 positions.

## Security model

- Every user-facing table has RLS scoped to `auth.uid()`.
- `rate_limits` has RLS enabled with **no policies** by design: it is a
  server-only counter table written through a `SECURITY DEFINER` function.
- Codes, bridge tokens, and session tokens are stored hashed with
  `CONNECTION_CODE_PEPPER`; tokens are signed with `BRIDGE_TOKEN_SECRET`.
- Sensitive fields are redacted by `src/lib/api/logger.ts` before logging.

## Environment

See `.env.example`. Server-only values are read inside handlers via
`process.env['NAME']`; browser values use `import.meta.env.VITE_*`.

## Testing

```bash
bunx vitest run
```

Unit tests cover code formatting/hashing, bridge token signing and expiry, the
API envelope, and the log redactor.

## API reference

`docs/openapi.yaml` documents the public Bridge contract. Application features
use typed server functions, not HTTP endpoints.
