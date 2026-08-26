ALTER TABLE public.mt5_authorization_requests
  ADD COLUMN IF NOT EXISTS environment text;

ALTER TABLE public.mt5_authorization_requests
  ADD CONSTRAINT mt5_authorization_requests_environment_check
  CHECK (environment IS NULL OR environment IN ('DEMO', 'REAL'));