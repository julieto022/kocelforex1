-- Phase 3.6.2: bot creation and management
-- Safe, additive migration for the existing production schema.

CREATE TABLE IF NOT EXISTS public.bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  strategy_id uuid NOT NULL REFERENCES public.strategies(id) ON DELETE RESTRICT,
  broker_connection_id uuid REFERENCES public.broker_connections(id) ON DELETE SET NULL,
  symbol text NOT NULL,
  timeframe text,
  risk_profile text NOT NULL DEFAULT 'BALANCED' CHECK (risk_profile IN ('CONSERVATIVE', 'BALANCED', 'AGGRESSIVE')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'STOPPED', 'RUNNING', 'PAUSED', 'WAITING', 'ERROR')),
  enabled boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(trim(name)) >= 2),
  CHECK (char_length(trim(symbol)) >= 2)
);

ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS strategy_id uuid,
  ADD COLUMN IF NOT EXISTS broker_connection_id uuid,
  ADD COLUMN IF NOT EXISTS symbol text,
  ADD COLUMN IF NOT EXISTS timeframe text,
  ADD COLUMN IF NOT EXISTS risk_profile text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS enabled boolean,
  ADD COLUMN IF NOT EXISTS configuration jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.bots
SET user_id = COALESCE(user_id, auth.uid())
WHERE user_id IS NULL;

UPDATE public.bots
SET risk_profile = COALESCE(risk_profile, 'BALANCED')
WHERE risk_profile IS NULL;

UPDATE public.bots
SET status = COALESCE(status, 'DRAFT')
WHERE status IS NULL;

UPDATE public.bots
SET enabled = COALESCE(enabled, true)
WHERE enabled IS NULL;

UPDATE public.bots
SET configuration = COALESCE(configuration, '{}'::jsonb)
WHERE configuration IS NULL;

ALTER TABLE public.bots
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN strategy_id SET NOT NULL,
  ALTER COLUMN symbol SET NOT NULL,
  ALTER COLUMN risk_profile SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN enabled SET NOT NULL,
  ALTER COLUMN configuration SET DEFAULT '{}'::jsonb,
  ALTER COLUMN configuration SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS bots_user_name_idx ON public.bots (user_id, lower(name));
CREATE INDEX IF NOT EXISTS bots_user_id_idx ON public.bots (user_id);
CREATE INDEX IF NOT EXISTS bots_strategy_idx ON public.bots (strategy_id);
CREATE INDEX IF NOT EXISTS bots_connection_idx ON public.bots (broker_connection_id);
CREATE INDEX IF NOT EXISTS bots_status_idx ON public.bots (status);

ALTER TABLE public.bots
  DROP CONSTRAINT IF EXISTS bots_strategy_id_fkey,
  DROP CONSTRAINT IF EXISTS bots_broker_connection_id_fkey;

ALTER TABLE public.bots
  ADD CONSTRAINT bots_strategy_id_fkey
  FOREIGN KEY (strategy_id) REFERENCES public.strategies(id) ON DELETE RESTRICT,
  ADD CONSTRAINT bots_broker_connection_id_fkey
  FOREIGN KEY (broker_connection_id) REFERENCES public.broker_connections(id) ON DELETE SET NULL;

ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bots FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bots TO authenticated;
GRANT ALL ON public.bots TO service_role;

DROP POLICY IF EXISTS "bots_owner_select" ON public.bots;
DROP POLICY IF EXISTS "bots_owner_insert" ON public.bots;
DROP POLICY IF EXISTS "bots_owner_update" ON public.bots;
DROP POLICY IF EXISTS "bots_owner_delete" ON public.bots;

CREATE POLICY "bots_owner_select"
  ON public.bots
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "bots_owner_insert"
  ON public.bots
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bots_owner_update"
  ON public.bots
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bots_owner_delete"
  ON public.bots
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS bots_updated_at ON public.bots;
CREATE TRIGGER bots_updated_at
  BEFORE UPDATE ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
