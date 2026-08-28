-- Approval is retried by browsers and can race with the EA poll. Keep the
-- request lock as the source of truth and return the existing connection for
-- a repeated approval by the same user.
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
   v_connection_id uuid;
BEGIN
   SELECT * INTO request_row
   FROM public.mt5_authorization_requests
   WHERE id = _request_id
   FOR UPDATE;

   IF NOT FOUND THEN RAISE EXCEPTION 'AUTHORIZATION_NOT_FOUND'; END IF;

   IF request_row.status = 'AUTHORIZED' THEN
      IF request_row.user_id <> _user_id THEN
         RAISE EXCEPTION 'AUTHORIZATION_OWNERSHIP_MISMATCH';
      END IF;
      RETURN request_row.connection_id;
   END IF;

   IF request_row.status <> 'WAITING_FOR_USER' THEN
      RAISE EXCEPTION 'AUTHORIZATION_ALREADY_DECIDED';
   END IF;
   IF request_row.user_id IS NOT NULL AND request_row.user_id <> _user_id THEN
      RAISE EXCEPTION 'AUTHORIZATION_OWNERSHIP_MISMATCH';
   END IF;
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

   BEGIN
      INSERT INTO public.broker_connections (
         user_id, broker_id, broker_name, account_name, nickname, mt5_login, server,
         account_type, environment, currency, leverage, terminal_name, terminal_company,
         status, ea_version, terminal_build, authorized_at
      ) VALUES (
         _user_id, NULL, trim(request_row.broker_hint),
         coalesce(request_row.account_name, 'MT5 account'), _nickname, request_row.mt5_login,
         request_row.server, _account_type, request_row.environment, request_row.currency,
         request_row.leverage, request_row.terminal_name, request_row.terminal_company,
         'AUTHORIZED', request_row.ea_version, request_row.terminal_build, now()
      ) RETURNING id INTO v_connection_id;
   EXCEPTION
      WHEN unique_violation THEN RAISE EXCEPTION 'DUPLICATE_CONNECTION';
   END;

   UPDATE public.mt5_authorization_requests
   SET status = 'AUTHORIZED', user_id = _user_id, connection_id = v_connection_id, decided_at = now()
   WHERE id = _request_id AND status = 'WAITING_FOR_USER';

   RETURN v_connection_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_mt5_authorization_request(uuid, uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_mt5_authorization_request(uuid, uuid, uuid, text, text, text, text) TO service_role;