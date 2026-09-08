CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system',
  timezone text NOT NULL DEFAULT 'UTC',
  language text NOT NULL DEFAULT 'en',
  date_format text NOT NULL DEFAULT 'YYYY-MM-DD',
  default_currency text NOT NULL DEFAULT 'USD',
  default_risk_profile text NOT NULL DEFAULT 'BALANCED',
  active_connection_id uuid REFERENCES public.broker_connections(id) ON DELETE SET NULL,
  notifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS date_format text NOT NULL DEFAULT 'YYYY-MM-DD',
  ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS default_risk_profile text NOT NULL DEFAULT 'BALANCED',
  ADD COLUMN IF NOT EXISTS active_connection_id uuid,
  ADD COLUMN IF NOT EXISTS notifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DELETE FROM public.user_settings duplicate_row
USING public.user_settings kept_row
WHERE duplicate_row.user_id = kept_row.user_id
  AND duplicate_row.ctid < kept_row.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_id_key
  ON public.user_settings (user_id);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_settings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;

DROP POLICY IF EXISTS user_settings_owner_select ON public.user_settings;
CREATE POLICY user_settings_owner_select ON public.user_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS user_settings_owner_insert ON public.user_settings;
CREATE POLICY user_settings_owner_insert ON public.user_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS user_settings_owner_update ON public.user_settings;
CREATE POLICY user_settings_owner_update ON public.user_settings
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS user_settings_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();