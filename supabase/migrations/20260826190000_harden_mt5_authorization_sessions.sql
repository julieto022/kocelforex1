ALTER TABLE public.mt5_authorization_requests
  ADD COLUMN IF NOT EXISTS poll_token_used_at timestamptz;

CREATE TABLE IF NOT EXISTS public.bridge_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

ALTER TABLE public.bridge_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS bridge_sessions_connection_idx ON public.bridge_sessions (connection_id, expires_at);
CREATE INDEX IF NOT EXISTS bridge_sessions_user_idx ON public.bridge_sessions (user_id);
REVOKE ALL ON public.bridge_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.bridge_sessions TO service_role;

ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS broker_connections_owner_select ON public.broker_connections;
CREATE POLICY broker_connections_owner_select ON public.broker_connections
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS broker_connections_owner_update ON public.broker_connections;
CREATE POLICY broker_connections_owner_update ON public.broker_connections
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS broker_connections_owner_delete ON public.broker_connections;
CREATE POLICY broker_connections_owner_delete ON public.broker_connections
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.approve_mt5_authorization_request(
  _request_id uuid,
  _user_id uuid,
  _broker_id uuid,
  _account_name text,
  _nickname text,
  _account_type text,
  _environment text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_row public.mt5_authorization_requests%ROWTYPE;
  broker_row public.brokers%ROWTYPE;
  v_connection_id uuid;
BEGIN
  SELECT * INTO request_row
  FROM public.mt5_authorization_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'AUTHORIZATION_NOT_FOUND'; END IF;
  IF request_row.status <> 'WAITING_FOR_USER' THEN RAISE EXCEPTION 'AUTHORIZATION_ALREADY_DECIDED'; END IF;
  IF request_row.expires_at <= now() THEN
    UPDATE public.mt5_authorization_requests SET status = 'EXPIRED' WHERE id = _request_id;
    RAISE EXCEPTION 'AUTHORIZATION_EXPIRED';
  END IF;
  IF request_row.environment IS NOT NULL AND request_row.environment <> _environment THEN
    RAISE EXCEPTION 'ENVIRONMENT_MISMATCH';
  END IF;

  SELECT * INTO broker_row FROM public.brokers WHERE id = _broker_id;
  IF NOT FOUND OR NOT broker_row.supported AND broker_row.status NOT IN ('supported', 'manual') THEN
    RAISE EXCEPTION 'BROKER_NOT_SUPPORTED';
  END IF;
  IF COALESCE(broker_row.connection_config->>'server_hint', '') <> ''
     AND broker_row.connection_config->>'server_hint' <> request_row.server THEN
    RAISE EXCEPTION 'SERVER_MISMATCH';
  END IF;

  INSERT INTO public.broker_connections (
    user_id, broker_id, account_name, nickname, mt5_login, server,
    account_type, environment, status, ea_version, terminal_build, authorized_at
  ) VALUES (
    _user_id, _broker_id, _account_name, _nickname, request_row.mt5_login, request_row.server,
    _account_type, _environment, 'AUTHORIZED', request_row.ea_version,
    request_row.terminal_build, now()
  ) RETURNING id INTO v_connection_id;

  UPDATE public.mt5_authorization_requests
  SET status = 'AUTHORIZED', user_id = _user_id, connection_id = v_connection_id, decided_at = now()
  WHERE id = _request_id;

  RETURN v_connection_id;
EXCEPTION
  WHEN unique_violation THEN RAISE EXCEPTION 'DUPLICATE_CONNECTION';
END;
$$;

REVOKE ALL ON FUNCTION public.approve_mt5_authorization_request(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_mt5_authorization_request(uuid, uuid, uuid, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.issue_bridge_session(
  _request_id uuid, _poll_token_hash text, _session_id uuid, _token_hash text,
  _user_id uuid, _connection_id uuid, _expires_at timestamptz
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request_row public.mt5_authorization_requests%ROWTYPE;
BEGIN
  SELECT * INTO request_row FROM public.mt5_authorization_requests
    WHERE id = _request_id AND poll_token_hash = _poll_token_hash FOR UPDATE;
  IF NOT FOUND OR request_row.status <> 'AUTHORIZED' THEN RAISE EXCEPTION 'AUTHORIZATION_NOT_AVAILABLE'; END IF;
  IF request_row.poll_token_used_at IS NOT NULL THEN RAISE EXCEPTION 'AUTHORIZATION_ALREADY_DECIDED'; END IF;
  IF request_row.connection_id <> _connection_id OR request_row.user_id <> _user_id THEN RAISE EXCEPTION 'AUTHORIZATION_OWNERSHIP_MISMATCH'; END IF;
  INSERT INTO public.bridge_sessions (id, connection_id, user_id, token_hash, expires_at)
    VALUES (_session_id, _connection_id, _user_id, _token_hash, _expires_at);
  UPDATE public.mt5_authorization_requests SET poll_token_used_at = now() WHERE id = _request_id;
  UPDATE public.broker_connections SET status = 'AUTHENTICATING' WHERE id = _connection_id AND user_id = _user_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_bridge_session(uuid, text, uuid, text, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_bridge_session(uuid, text, uuid, text, uuid, uuid, timestamptz) TO service_role;
