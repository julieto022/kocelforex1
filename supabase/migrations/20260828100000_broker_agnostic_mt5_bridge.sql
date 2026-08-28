ALTER TABLE public.mt5_authorization_requests
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS leverage integer,
  ADD COLUMN IF NOT EXISTS terminal_name text,
  ADD COLUMN IF NOT EXISTS terminal_company text;

ALTER TABLE public.broker_connections
  ALTER COLUMN broker_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS broker_name text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS leverage integer,
  ADD COLUMN IF NOT EXISTS terminal_name text,
  ADD COLUMN IF NOT EXISTS terminal_company text;

DROP INDEX IF EXISTS public.broker_connections_user_login_server_idx;
CREATE UNIQUE INDEX IF NOT EXISTS broker_connections_user_broker_login_server_idx
  ON public.broker_connections (user_id, broker_name, mt5_login, server);

CREATE OR REPLACE FUNCTION public.approve_mt5_authorization_request(
  _request_id uuid,
  _user_id uuid,
  _broker_id uuid,
  _account_name text,
  _nickname text,
  _account_type text,
  _environment text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_row public.mt5_authorization_requests%ROWTYPE;
  catalog_broker_id uuid;
  v_connection_id uuid;
BEGIN
  SELECT * INTO request_row
  FROM public.mt5_authorization_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'AUTHORIZATION_NOT_FOUND'; END IF;
  IF request_row.status <> 'WAITING_FOR_USER' THEN RAISE EXCEPTION 'AUTHORIZATION_ALREADY_DECIDED'; END IF;
  IF request_row.expires_at <= now() THEN
    UPDATE public.mt5_authorization_requests
    SET status = 'EXPIRED'
    WHERE id = _request_id AND status = 'WAITING_FOR_USER';
    RAISE EXCEPTION 'AUTHORIZATION_EXPIRED';
  END IF;
  IF request_row.mt5_login !~ '^[0-9]{4,20}$'
     OR length(request_row.server) < 2
     OR length(request_row.server) > 120
     OR request_row.server ~ '[[:cntrl:]]'
     OR request_row.broker_hint IS NULL
     OR length(trim(request_row.broker_hint)) < 1
     OR length(trim(request_row.broker_hint)) > 120
  THEN RAISE EXCEPTION 'INVALID_BROKER_IDENTITY'; END IF;
  IF request_row.environment NOT IN ('DEMO', 'REAL') THEN RAISE EXCEPTION 'INVALID_ENVIRONMENT'; END IF;
  IF _environment IS NOT NULL AND _environment <> request_row.environment THEN
    RAISE EXCEPTION 'ENVIRONMENT_MISMATCH';
  END IF;

  SELECT id INTO catalog_broker_id
  FROM public.brokers
  WHERE lower(name) = lower(trim(request_row.broker_hint))
     OR lower(slug) = lower(trim(request_row.broker_hint))
  LIMIT 1;

  INSERT INTO public.broker_connections (
    user_id, broker_id, broker_name, account_name, nickname, mt5_login, server,
    account_type, environment, currency, leverage, terminal_name, terminal_company,
    status, ea_version, terminal_build, authorized_at
  ) VALUES (
    _user_id, catalog_broker_id, trim(request_row.broker_hint),
    coalesce(request_row.account_name, 'MT5 account'), NULL, request_row.mt5_login,
    request_row.server, NULL, request_row.environment, request_row.currency,
    request_row.leverage, request_row.terminal_name, request_row.terminal_company,
    'AUTHORIZED', request_row.ea_version, request_row.terminal_build, now()
  ) RETURNING id INTO v_connection_id;

  UPDATE public.mt5_authorization_requests
  SET status = 'AUTHORIZED', user_id = _user_id, connection_id = v_connection_id, decided_at = now()
  WHERE id = _request_id AND status = 'WAITING_FOR_USER';

  RETURN v_connection_id;
EXCEPTION
  WHEN unique_violation THEN RAISE EXCEPTION 'DUPLICATE_CONNECTION';
END;
$$;

REVOKE ALL ON FUNCTION public.approve_mt5_authorization_request(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_mt5_authorization_request(uuid, uuid, uuid, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.issue_bridge_session(
  _request_id uuid,
  _poll_token_hash text,
  _session_id uuid,
  _token_hash text,
  _user_id uuid,
  _connection_id uuid,
  _expires_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_row public.mt5_authorization_requests%ROWTYPE;
BEGIN
  SELECT * INTO request_row
  FROM public.mt5_authorization_requests
  WHERE id = _request_id AND poll_token_hash = _poll_token_hash
  FOR UPDATE;
  IF NOT FOUND OR request_row.status <> 'AUTHORIZED' THEN
    RAISE EXCEPTION 'AUTHORIZATION_NOT_AVAILABLE';
  END IF;
  IF request_row.poll_token_used_at IS NOT NULL THEN
    RAISE EXCEPTION 'AUTHORIZATION_ALREADY_DECIDED';
  END IF;
  IF request_row.connection_id <> _connection_id OR request_row.user_id <> _user_id THEN
    RAISE EXCEPTION 'AUTHORIZATION_OWNERSHIP_MISMATCH';
  END IF;

  INSERT INTO public.bridge_sessions (id, connection_id, user_id, request_id, token_hash, expires_at)
  VALUES (_session_id, _connection_id, _user_id, _request_id, _token_hash, _expires_at);
  UPDATE public.mt5_authorization_requests SET poll_token_used_at = now() WHERE id = _request_id;
  UPDATE public.broker_connections
  SET status = 'AUTHENTICATING'
  WHERE id = _connection_id AND user_id = _user_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_bridge_session(uuid, text, uuid, text, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_bridge_session(uuid, text, uuid, text, uuid, uuid, timestamptz) TO service_role;