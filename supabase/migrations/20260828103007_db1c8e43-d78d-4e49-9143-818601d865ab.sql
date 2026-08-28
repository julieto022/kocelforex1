ALTER TABLE public.mt5_authorization_requests
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS leverage integer,
  ADD COLUMN IF NOT EXISTS terminal_name text,
  ADD COLUMN IF NOT EXISTS terminal_company text;

ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS leverage integer,
  ADD COLUMN IF NOT EXISTS terminal_name text,
  ADD COLUMN IF NOT EXISTS terminal_company text;

ALTER TABLE public.mt5_authorization_requests
  DROP CONSTRAINT IF EXISTS mt5_authorization_requests_leverage_check;
ALTER TABLE public.mt5_authorization_requests
  ADD CONSTRAINT mt5_authorization_requests_leverage_check
  CHECK (leverage IS NULL OR (leverage >= 0 AND leverage <= 10000));

ALTER TABLE public.broker_connections
  DROP CONSTRAINT IF EXISTS broker_connections_leverage_check;
ALTER TABLE public.broker_connections
  ADD CONSTRAINT broker_connections_leverage_check
  CHECK (leverage IS NULL OR (leverage >= 0 AND leverage <= 10000));