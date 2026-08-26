CREATE TABLE public.mt5_authorization_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mt5_login text NOT NULL,
  server text NOT NULL,
  account_name text,
  broker_hint text,
  ea_version text NOT NULL,
  terminal_build text,
  poll_token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'WAITING_FOR_USER',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.broker_connections(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mt5_authorization_requests_status_check
    CHECK (status IN ('AUTHORIZATION_REQUESTED','WAITING_FOR_USER','AUTHORIZED','REJECTED','EXPIRED','REVOKED'))
);

GRANT ALL ON public.mt5_authorization_requests TO service_role;

ALTER TABLE public.mt5_authorization_requests ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: this table is written and read only by trusted
-- server code (service role). Neither anon nor authenticated may reach it.

CREATE UNIQUE INDEX mt5_auth_requests_poll_token_hash_idx
  ON public.mt5_authorization_requests (poll_token_hash);
CREATE INDEX mt5_auth_requests_status_idx
  ON public.mt5_authorization_requests (status, expires_at);
CREATE INDEX mt5_auth_requests_user_idx
  ON public.mt5_authorization_requests (user_id);

CREATE TRIGGER mt5_authorization_requests_set_updated_at
  BEFORE UPDATE ON public.mt5_authorization_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.broker_connections
  DROP COLUMN IF EXISTS connection_code,
  DROP COLUMN IF EXISTS connection_code_hash,
  DROP COLUMN IF EXISTS connection_code_expires_at,
  DROP COLUMN IF EXISTS code_state,
  DROP COLUMN IF EXISTS claimed_at,
  ADD COLUMN IF NOT EXISTS terminal_build text,
  ADD COLUMN IF NOT EXISTS authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS broker_connections_user_login_server_idx
  ON public.broker_connections (user_id, mt5_login, server);

DROP FUNCTION IF EXISTS public.create_broker_connection;

REVOKE ALL ON FUNCTION public.bump_rate_limit(text, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, timestamptz, integer) TO service_role;

REVOKE ALL ON FUNCTION public.soft_delete_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_account(uuid) TO authenticated, service_role;