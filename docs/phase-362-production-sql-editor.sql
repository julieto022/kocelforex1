-- Kocel Forex Hub Phase 3.6.2 production SQL Editor script
-- Purpose:
--   1. Activate the existing Kocel AI Scalper strategy.
--   2. Create it only if the production database does not contain it.
--   3. Verify the bots.symbol column and bot RLS policies.
--
-- This script is idempotent. Run it in the production Supabase SQL Editor.
-- It does not create a second strategy when slug = 'kocel-ai-scalper' exists.
-- Manual MT5 symbol entry requires no new column: bots.symbol is reused.

BEGIN;

-- Ensure the strategy schema used by the application exists without replacing data.
ALTER TABLE public.strategies
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS short_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_builtin boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS timeframe text,
  ADD COLUMN IF NOT EXISTS timeframes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS markets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS configuration_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS strategies_slug_key
  ON public.strategies (slug);

-- Activate the existing row first. This preserves its existing UUID.
UPDATE public.strategies
SET is_active = true,
    status = 'available',
    is_builtin = true,
    updated_at = now()
WHERE slug = 'kocel-ai-scalper';

-- Insert only when the stable slug is absent. The unique slug prevents duplicates.
INSERT INTO public.strategies
  (name, slug, category, description, short_description, is_active, is_builtin,
   configuration, timeframe, timeframes, markets, status, configuration_schema)
VALUES
  ('Kocel AI Scalper',
   'kocel-ai-scalper',
   'Scalping',
   'Short-timeframe scalping logic driven by Kocel intelligence. Execution remains outside this phase.',
   'Kocel AI strategy definition for short-timeframe scalping.',
   true,
   true,
   '{}'::jsonb,
   'M5',
   '["M1","M5","M15"]'::jsonb,
   '["forex","metals","indices"]'::jsonb,
   'available',
   '{"fields":[{"key":"max_spread","type":"number"},{"key":"risk_percent","type":"number"}]}'::jsonb)
ON CONFLICT (slug) DO UPDATE
SET is_active = true,
    status = 'available',
    is_builtin = true,
    updated_at = now();

-- Strategies are system-owned and read-only for authenticated users.
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.strategies FROM anon, authenticated;
GRANT SELECT ON public.strategies TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can read active strategies" ON public.strategies;
DROP POLICY IF EXISTS strategies_owner_select ON public.strategies;
DROP POLICY IF EXISTS strategies_owner_insert ON public.strategies;
DROP POLICY IF EXISTS strategies_owner_update ON public.strategies;
DROP POLICY IF EXISTS strategies_owner_delete ON public.strategies;

CREATE POLICY "Authenticated users can read active strategies"
  ON public.strategies
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- The existing bots table and bots.symbol column are reused by manual symbol entry.
-- No market_symbols row is required to create a bot.
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bots TO authenticated;

DROP POLICY IF EXISTS "bots_owner_select" ON public.bots;
DROP POLICY IF EXISTS "bots_owner_insert" ON public.bots;
DROP POLICY IF EXISTS "bots_owner_update" ON public.bots;
DROP POLICY IF EXISTS "bots_owner_delete" ON public.bots;

CREATE POLICY "bots_owner_select"
  ON public.bots FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "bots_owner_insert"
  ON public.bots FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bots_owner_update"
  ON public.bots FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bots_owner_delete"
  ON public.bots FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMIT;

-- Verification 1: exactly one Kocel AI Scalper row and its active state.
SELECT id, name, slug, is_active, is_builtin, status, category, timeframes
FROM public.strategies
WHERE slug = 'kocel-ai-scalper';

SELECT COUNT(*) AS kocel_ai_scalper_count
FROM public.strategies
WHERE slug = 'kocel-ai-scalper';

-- Verification 2: bots.symbol exists with the expected text type.
SELECT column_name, data_type, is_nullable, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bots'
  AND column_name = 'symbol';

-- Verification 3: bot foreign keys and RLS policies.
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'bots'
  AND constraint_name IN ('bots_strategy_id_fkey', 'bots_broker_connection_id_fkey');

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('strategies', 'bots')
ORDER BY tablename, policyname;
