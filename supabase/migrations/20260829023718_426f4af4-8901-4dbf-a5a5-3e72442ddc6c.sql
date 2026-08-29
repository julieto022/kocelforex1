DROP FUNCTION IF EXISTS public.approve_mt5_authorization_request(uuid, uuid, uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.approve_mt5_authorization_request(_request_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req public.mt5_authorization_requests%ROWTYPE;
  v_broker_id uuid;
  v_slug text;
  v_name text;
  v_env text;
  new_connection_id uuid;
BEGIN
  SELECT * INTO req FROM public.mt5_authorization_requests
  WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AUTHORIZATION_NOT_FOUND'; END IF;

  -- Idempotent: a repeat approval by the same user returns the same connection.
  IF req.status = 'AUTHORIZED' AND req.connection_id IS NOT NULL THEN
    IF req.user_id IS DISTINCT FROM _user_id THEN
      RAISE EXCEPTION 'AUTHORIZATION_ALREADY_DECIDED';
    END IF;
    RETURN req.connection_id;
  END IF;
  IF req.status <> 'WAITING_FOR_USER' THEN RAISE EXCEPTION 'AUTHORIZATION_ALREADY_DECIDED'; END IF;
  IF req.expires_at < now() THEN RAISE EXCEPTION 'AUTHORIZATION_EXPIRED'; END IF;

  v_env := upper(coalesce(req.environment, ''));
  IF v_env NOT IN ('DEMO', 'REAL') THEN RAISE EXCEPTION 'INVALID_ENVIRONMENT'; END IF;

  v_name := nullif(btrim(coalesce(req.broker_hint, req.terminal_company, '')), '');
  IF v_name IS NULL THEN RAISE EXCEPTION 'INVALID_BROKER_IDENTITY'; END IF;

  -- Broker agnostic: any MT5 broker reported by the terminal is accepted and
  -- registered on first use as metadata.
  v_slug := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
  IF v_slug = '' THEN RAISE EXCEPTION 'INVALID_BROKER_IDENTITY'; END IF;

  SELECT id INTO v_broker_id FROM public.brokers WHERE slug = v_slug;
  IF v_broker_id IS NULL THEN
    INSERT INTO public.brokers (name, slug, status, supported)
    VALUES (v_name, v_slug, 'supported', true)
    ON CONFLICT (slug) DO UPDATE SET name = public.brokers.name
    RETURNING id INTO v_broker_id;
  END IF;

  INSERT INTO public.broker_connections (
    user_id, broker_id, account_name, nickname, mt5_login, server,
    account_type, environment, status, ea_version, terminal_build,
    terminal_name, terminal_company, currency, leverage, authorized_at, revoked_at
  ) VALUES (
    _user_id, v_broker_id,
    coalesce(nullif(btrim(coalesce(req.account_name, '')), ''), v_name || ' ' || req.mt5_login),
    nullif(btrim(coalesce(req.account_name, '')), ''),
    req.mt5_login, req.server,
    req.account_name, v_env, 'AUTHORIZED', req.ea_version, req.terminal_build,
    req.terminal_name, req.terminal_company, req.currency, req.leverage, now(), NULL
  )
  ON CONFLICT (user_id, mt5_login, server) DO UPDATE SET
    broker_id = EXCLUDED.broker_id,
    environment = EXCLUDED.environment,
    status = 'AUTHORIZED',
    ea_version = EXCLUDED.ea_version,
    terminal_build = EXCLUDED.terminal_build,
    terminal_name = EXCLUDED.terminal_name,
    terminal_company = EXCLUDED.terminal_company,
    currency = EXCLUDED.currency,
    leverage = EXCLUDED.leverage,
    authorized_at = now(),
    revoked_at = NULL,
    updated_at = now()
  RETURNING id INTO new_connection_id;

  UPDATE public.mt5_authorization_requests
  SET status = 'AUTHORIZED',
      user_id = _user_id,
      connection_id = new_connection_id,
      decided_at = now()
  WHERE id = _request_id;

  RETURN new_connection_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_mt5_authorization_request(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_mt5_authorization_request(uuid, uuid) TO service_role;