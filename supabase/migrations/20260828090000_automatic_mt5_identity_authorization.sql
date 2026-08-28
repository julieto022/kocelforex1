-- Phase 3.2: broker and terminal identity come only from the EA request.
UPDATE public.brokers
SET connection_config = connection_config ||
  CASE slug
    WHEN 'exness' THEN '{"broker_hints":["exness","exness technologies ltd"],"server_patterns":["Exness-MT5%"]}'::jsonb
    WHEN 'deriv' THEN '{"broker_hints":["deriv","deriv limited"],"server_patterns":["Deriv-Server%"]}'::jsonb
    ELSE '{}'::jsonb
  END
WHERE slug IN ('exness', 'deriv');

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
  broker_row public.brokers%ROWTYPE;
  v_connection_id uuid;
  broker_hint text;
  server_pattern text;
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
  IF request_row.environment NOT IN ('DEMO', 'REAL') THEN RAISE EXCEPTION 'INVALID_ENVIRONMENT'; END IF;
  IF _environment IS NOT NULL AND _environment <> request_row.environment THEN
    RAISE EXCEPTION 'ENVIRONMENT_MISMATCH';
  END IF;

  broker_hint := lower(trim(coalesce(request_row.broker_hint, '')));
  SELECT * INTO broker_row
  FROM public.brokers
  WHERE supported IS TRUE
    AND status IN ('supported', 'active')
    AND (
      lower(slug) = broker_hint
      OR lower(name) = broker_hint
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(connection_config->'broker_hints') = 'array'
            THEN connection_config->'broker_hints' ELSE '[]'::jsonb END
        ) AS hint(value)
        WHERE lower(trim(hint.value)) = broker_hint
      )
    )
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'BROKER_NOT_SUPPORTED'; END IF;

  SELECT value INTO server_pattern
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(broker_row.connection_config->'server_patterns') = 'array'
      THEN broker_row.connection_config->'server_patterns' ELSE '[]'::jsonb END
  ) AS pattern(value)
  WHERE request_row.server ILIKE value
  LIMIT 1;
  IF server_pattern IS NULL THEN RAISE EXCEPTION 'SERVER_MISMATCH'; END IF;

  INSERT INTO public.broker_connections (
    user_id, broker_id, account_name, nickname, mt5_login, server,
    account_type, environment, status, ea_version, terminal_build, authorized_at
  ) VALUES (
    _user_id, broker_row.id, coalesce(request_row.account_name, 'MT5 account'), NULL,
    request_row.mt5_login, request_row.server, NULL, request_row.environment,
    'AUTHORIZED', request_row.ea_version, request_row.terminal_build, now()
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