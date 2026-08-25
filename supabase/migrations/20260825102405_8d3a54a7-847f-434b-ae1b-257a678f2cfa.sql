-- Atomic rate-limit counter. Server-only.
CREATE OR REPLACE FUNCTION public.bump_rate_limit(
  _bucket_key text,
  _window_start timestamptz,
  _window_seconds integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hits integer;
BEGIN
  INSERT INTO public.rate_limits (bucket_key, window_start, window_seconds, hits)
  VALUES (_bucket_key, _window_start, _window_seconds, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET hits = public.rate_limits.hits + 1
  RETURNING hits INTO _hits;

  DELETE FROM public.rate_limits WHERE window_start < now() - interval '2 days';

  RETURN _hits;
END; $$;

REVOKE EXECUTE ON FUNCTION public.bump_rate_limit(text, timestamptz, integer) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_rate_limit(text, timestamptz, integer) TO service_role;

-- Transactional broker-connection creation. Server-only.
CREATE OR REPLACE FUNCTION public.create_broker_connection(
  _user_id uuid,
  _broker_id uuid,
  _account_name text,
  _nickname text,
  _mt5_login text,
  _server text,
  _account_type text,
  _environment text,
  _code_hash text,
  _code_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.broker_connections
    WHERE user_id = _user_id AND broker_id = _broker_id AND mt5_login = _mt5_login
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_CONNECTION';
  END IF;

  INSERT INTO public.broker_connections (
    user_id, broker_id, account_name, nickname, mt5_login, server, account_type,
    environment, status, code_state, connection_code_hash, connection_code_expires_at
  ) VALUES (
    _user_id, _broker_id, _account_name, _nickname, _mt5_login, _server, _account_type,
    _environment, 'WAITING_FOR_BRIDGE', 'WAITING', _code_hash, _code_expires_at
  ) RETURNING id INTO _id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id)
  VALUES (_user_id, 'CONNECTION_CREATED', 'broker_connection', _id::text);

  RETURN _id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_broker_connection(uuid, uuid, text, text, text, text, text, text, text, timestamptz) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_broker_connection(uuid, uuid, text, text, text, text, text, text, text, timestamptz) TO service_role;

-- Account deletion foundation: soft-delete + anonymise, retain trading records.
CREATE OR REPLACE FUNCTION public.soft_delete_account(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET status = 'DELETED',
      deleted_at = now(),
      full_name = 'Deleted user',
      username = NULL,
      email = NULL,
      phone = NULL,
      country = NULL,
      avatar_url = NULL
  WHERE id = _user_id;

  UPDATE public.user_sessions SET revoked_at = now() WHERE user_id = _user_id AND revoked_at IS NULL;
  DELETE FROM public.broker_connections WHERE user_id = _user_id;
  UPDATE public.bots SET status = 'STOPPED' WHERE user_id = _user_id;
  UPDATE public.community_posts SET status = 'REMOVED' WHERE user_id = _user_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id)
  VALUES (_user_id, 'ACCOUNT_DELETION_REQUESTED', 'profile', _user_id::text);
END; $$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_account(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_account(uuid) TO service_role;