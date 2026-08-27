ALTER TABLE public.mt5_authorization_requests
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS poll_token_used_at timestamptz;

ALTER TABLE public.mt5_authorization_requests
  DROP CONSTRAINT IF EXISTS mt5_authorization_requests_environment_check;
ALTER TABLE public.mt5_authorization_requests
  ADD CONSTRAINT mt5_authorization_requests_environment_check
  CHECK (environment IS NULL OR environment IN ('DEMO','REAL'));

CREATE TABLE IF NOT EXISTS public.bridge_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.mt5_authorization_requests(id) ON DELETE SET NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bridge_sessions_connection_id_idx ON public.bridge_sessions (connection_id);
CREATE INDEX IF NOT EXISTS bridge_sessions_user_id_idx ON public.bridge_sessions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS bridge_sessions_token_hash_idx ON public.bridge_sessions (token_hash);

GRANT ALL ON public.bridge_sessions TO service_role;
ALTER TABLE public.bridge_sessions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_bridge_sessions_updated_at ON public.bridge_sessions;
CREATE TRIGGER set_bridge_sessions_updated_at
  BEFORE UPDATE ON public.bridge_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
  req public.mt5_authorization_requests%ROWTYPE;
  new_connection_id uuid;
  broker_ok boolean;
BEGIN
  SELECT * INTO req FROM public.mt5_authorization_requests
  WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AUTHORIZATION_NOT_FOUND'; END IF;
  IF req.status <> 'WAITING_FOR_USER' THEN RAISE EXCEPTION 'AUTHORIZATION_ALREADY_DECIDED'; END IF;
  IF req.expires_at < now() THEN RAISE EXCEPTION 'AUTHORIZATION_EXPIRED'; END IF;
  IF req.environment IS NOT NULL AND req.environment <> _environment THEN
    RAISE EXCEPTION 'ENVIRONMENT_MISMATCH';
  END IF;

  SELECT (status = 'ACTIVE' OR supported IS TRUE) INTO broker_ok
  FROM public.brokers WHERE id = _broker_id;
  IF broker_ok IS NULL OR broker_ok IS FALSE THEN RAISE EXCEPTION 'BROKER_NOT_SUPPORTED'; END IF;

  BEGIN
    INSERT INTO public.broker_connections (
      user_id, broker_id, account_name, nickname, mt5_login, server,
      account_type, environment, status, ea_version, terminal_build, authorized_at
    ) VALUES (
      _user_id, _broker_id, _account_name, _nickname, req.mt5_login, req.server,
      _account_type, _environment, 'AUTHORIZED', req.ea_version, req.terminal_build, now()
    ) RETURNING id INTO new_connection_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'DUPLICATE_CONNECTION';
  END;

  UPDATE public.mt5_authorization_requests
  SET status = 'AUTHORIZED',
      user_id = _user_id,
      connection_id = new_connection_id,
      decided_at = now()
  WHERE id = _request_id;

  RETURN new_connection_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_mt5_authorization_request(uuid,uuid,uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_mt5_authorization_request(uuid,uuid,uuid,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.issue_bridge_session(
  _request_id uuid,
  _poll_token_hash text,
  _session_id uuid,
  _token_hash text,
  _user_id uuid,
  _connection_id uuid,
  _expires_at timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.mt5_authorization_requests%ROWTYPE;
BEGIN
  SELECT * INTO req FROM public.mt5_authorization_requests
  WHERE id = _request_id AND poll_token_hash = _poll_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AUTHORIZATION_NOT_FOUND'; END IF;
  IF req.status <> 'AUTHORIZED' THEN RAISE EXCEPTION 'AUTHORIZATION_ALREADY_DECIDED'; END IF;
  IF req.poll_token_used_at IS NOT NULL THEN RAISE EXCEPTION 'AUTHORIZATION_ALREADY_DECIDED'; END IF;

  INSERT INTO public.bridge_sessions (id, user_id, connection_id, request_id, token_hash, expires_at)
  VALUES (_session_id, _user_id, _connection_id, _request_id, _token_hash, _expires_at);

  UPDATE public.mt5_authorization_requests
  SET poll_token_used_at = now()
  WHERE id = _request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_bridge_session(uuid,text,uuid,text,uuid,uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_bridge_session(uuid,text,uuid,text,uuid,uuid,timestamptz) TO service_role;