-- Kocel Phase 3.6.1 - Strategy Library manual production migration
-- Run this entire script in the Supabase SQL Editor for project:
-- olyltcymfnmuayvdfqer
--
-- This script is idempotent. It reuses public.strategies, does not create
-- user-owned strategy records, and does not require a service-role key.

BEGIN;

CREATE TABLE IF NOT EXISTS public.strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  description text NOT NULL DEFAULT '',
  short_description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  timeframe text,
  timeframes jsonb NOT NULL DEFAULT '[]'::jsonb,
  markets jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'available',
  configuration_schema jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.strategies
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS short_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_builtin boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS timeframe text,
  ADD COLUMN IF NOT EXISTS timeframes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS markets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS configuration_schema jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Existing legacy rows are official system rows. Only clear ownership metadata
-- when the legacy column exists; this keeps the script compatible with either
-- version of the table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'strategies' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'UPDATE public.strategies SET user_id = NULL';
  END IF;
END $$;

UPDATE public.strategies SET is_builtin = true WHERE is_builtin IS DISTINCT FROM true;

CREATE UNIQUE INDEX IF NOT EXISTS strategies_slug_key ON public.strategies (slug);
CREATE INDEX IF NOT EXISTS strategies_active_category_idx
  ON public.strategies (category, name)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS strategies_updated_at ON public.strategies;
CREATE TRIGGER strategies_updated_at
  BEFORE UPDATE ON public.strategies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON TABLE public.strategies TO authenticated;
GRANT ALL ON TABLE public.strategies TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.strategies FROM anon, authenticated;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read active strategies" ON public.strategies;
DROP POLICY IF EXISTS strategies_owner_select ON public.strategies;
DROP POLICY IF EXISTS strategies_owner_insert ON public.strategies;
DROP POLICY IF EXISTS strategies_owner_update ON public.strategies;
DROP POLICY IF EXISTS strategies_owner_delete ON public.strategies;

CREATE POLICY "Authenticated users can read active strategies"
  ON public.strategies
  FOR SELECT TO authenticated
  USING (is_active = true);

INSERT INTO public.strategies
  (name, slug, category, description, short_description, is_active,
   is_builtin, configuration, timeframe, timeframes, markets, status,
   configuration_schema)
VALUES
  ('Micro-Momentum', 'micro-momentum', 'Scalping',
   'Captures short bursts of directional momentum around active market sessions.',
   'Short bursts of momentum on low timeframes.', true, true,
   '{"timeframes":["M1","M5"],"indicators":["EMA","ATR"],"entry_conditions":["momentum expansion"],"exit_conditions":["momentum loss"],"filters":["spread"],"risk_parameters":{}}'::jsonb,
   'M1', '["M1","M5"]'::jsonb, '["forex","indices"]'::jsonb, 'available', '{}'::jsonb),
  ('Momentum', 'momentum', 'Scalping',
   'Follows confirmed intraday momentum after a directional move establishes.',
   'Confirmed momentum continuation for active sessions.', true, true,
   '{"timeframes":["M5","M15"],"indicators":["RSI","ADX"],"entry_conditions":["momentum confirmation"],"exit_conditions":["momentum reversal"],"filters":["session"],"risk_parameters":{}}'::jsonb,
   'M5', '["M5","M15"]'::jsonb, '["forex","metals"]'::jsonb, 'available', '{}'::jsonb),
  ('EMA Pullback', 'ema-pullback', 'Scalping',
   'Looks for controlled pullbacks into an established exponential moving-average trend.',
   'Trend pullbacks around dynamic EMA support or resistance.', true, true,
   '{"timeframes":["M5","M15"],"indicators":["EMA 20","EMA 50"],"entry_conditions":["pullback rejection"],"exit_conditions":["trend invalidation"],"filters":["spread"],"risk_parameters":{}}'::jsonb,
   'M5', '["M5","M15"]'::jsonb, '["forex","metals","indices"]'::jsonb, 'available', '{}'::jsonb),
  ('Price Action', 'price-action', 'Scalping',
   'Uses market structure and candlestick behavior to frame short-term entries.',
   'Short-term entries from clean market structure.', true, true,
   '{"timeframes":["M5","M15"],"indicators":[],"entry_conditions":["structure break","candle confirmation"],"exit_conditions":["structure failure"],"filters":["session"],"risk_parameters":{}}'::jsonb,
   'M5', '["M5","M15"]'::jsonb, '["forex","indices"]'::jsonb, 'available', '{}'::jsonb),
  ('Break & Retest', 'break-retest', 'Scalping',
   'Waits for a confirmed level break and a retest before considering continuation.',
   'Level breaks confirmed by a retest.', true, true,
   '{"timeframes":["M5","M15"],"indicators":["ATR"],"entry_conditions":["level break","successful retest"],"exit_conditions":["failed retest"],"filters":["volatility"],"risk_parameters":{}}'::jsonb,
   'M5', '["M5","M15"]'::jsonb, '["forex","indices","crypto"]'::jsonb, 'available', '{}'::jsonb),
  ('Liquidity Sweep', 'liquidity-sweep', 'Scalping',
   'Identifies stop-run behavior around visible highs, lows, and session liquidity.',
   'Reversal setups after a liquidity sweep.', true, true,
   '{"timeframes":["M5","M15"],"indicators":[],"entry_conditions":["liquidity sweep","rejection"],"exit_conditions":["reclaim failure"],"filters":["session"],"risk_parameters":{}}'::jsonb,
   'M5', '["M5","M15"]'::jsonb, '["forex","metals"]'::jsonb, 'available', '{}'::jsonb),
  ('VWAP', 'vwap', 'Scalping',
   'Uses volume-weighted price as an intraday reference for continuation and reversion.',
   'Intraday setups around volume-weighted price.', true, true,
   '{"timeframes":["M1","M5","M15"],"indicators":["VWAP"],"entry_conditions":["VWAP reclaim or rejection"],"exit_conditions":["VWAP invalidation"],"filters":["session"],"risk_parameters":{}}'::jsonb,
   'M5', '["M1","M5","M15"]'::jsonb, '["forex","indices"]'::jsonb, 'available', '{}'::jsonb),
  ('ATR Volatility', 'atr-volatility', 'Scalping',
   'Adjusts entry context to current volatility using average true range behavior.',
   'Volatility-aware short-term setups.', true, true,
   '{"timeframes":["M5","M15"],"indicators":["ATR"],"entry_conditions":["volatility expansion"],"exit_conditions":["volatility contraction"],"filters":["spread"],"risk_parameters":{}}'::jsonb,
   'M5', '["M5","M15"]'::jsonb, '["forex","metals","indices"]'::jsonb, 'available', '{}'::jsonb),
  ('Session', 'session', 'Scalping',
   'Focuses short-term analysis on defined market sessions and their opening behavior.',
   'Session-aware setups for active market windows.', true, true,
   '{"timeframes":["M5","M15"],"indicators":[],"entry_conditions":["session open behavior"],"exit_conditions":["session close"],"filters":["session"],"risk_parameters":{}}'::jsonb,
   'M5', '["M5","M15"]'::jsonb, '["forex","indices"]'::jsonb, 'available', '{}'::jsonb),
  ('Range', 'range', 'Scalping',
   'Trades bounded intraday movement between established support and resistance areas.',
   'Short-term reversion inside a defined range.', true, true,
   '{"timeframes":["M5","M15"],"indicators":["ATR"],"entry_conditions":["range boundary reaction"],"exit_conditions":["range break"],"filters":["low trend strength"],"risk_parameters":{}}'::jsonb,
   'M5', '["M5","M15"]'::jsonb, '["forex","metals"]'::jsonb, 'available', '{}'::jsonb),
  ('Day Trading', 'day-trading', 'Day Trading',
   'Intraday strategy definitions designed to open and close positions within one session.',
   'Session-bounded intraday trading definitions.', true, true,
   '{"timeframes":["M15","H1"],"indicators":["EMA","ATR"],"entry_conditions":["intraday confirmation"],"exit_conditions":["session exit"],"filters":["session"],"risk_parameters":{}}'::jsonb,
   'M15', '["M15","H1"]'::jsonb, '["forex","indices","metals"]'::jsonb, 'available', '{}'::jsonb),
  ('Swing Trading', 'swing-trading', 'Swing Trading',
   'Targets multi-day directional moves using higher-timeframe market structure.',
   'Multi-day structure and trend setups.', true, true,
   '{"timeframes":["H4","D1"],"indicators":["EMA","RSI"],"entry_conditions":["swing structure confirmation"],"exit_conditions":["structure invalidation"],"filters":["higher timeframe"],"risk_parameters":{}}'::jsonb,
   'H4', '["H4","D1"]'::jsonb, '["forex","indices","commodities"]'::jsonb, 'available', '{}'::jsonb),
  ('Position Trading', 'position-trading', 'Position Trading',
   'Frames longer-horizon positions around durable macro and technical direction.',
   'Longer-horizon directional definitions.', true, true,
   '{"timeframes":["D1","W1"],"indicators":["EMA","ADX"],"entry_conditions":["long-term trend confirmation"],"exit_conditions":["macro or trend invalidation"],"filters":["higher timeframe"],"risk_parameters":{}}'::jsonb,
   'D1', '["D1","W1"]'::jsonb, '["forex","indices","commodities"]'::jsonb, 'available', '{}'::jsonb),
  ('Trend Following', 'trend-following', 'Trend Following',
   'Follows established directional trends while filtering out weak or conflicting conditions.',
   'Systematic participation in established trends.', true, true,
   '{"timeframes":["H1","H4","D1"],"indicators":["EMA","ADX"],"entry_conditions":["trend alignment"],"exit_conditions":["trend reversal"],"filters":["directional strength"],"risk_parameters":{}}'::jsonb,
   'H1', '["H1","H4","D1"]'::jsonb, '["forex","indices","commodities"]'::jsonb, 'available', '{}'::jsonb),
  ('Range Trading', 'range-trading', 'Range Trading',
   'Defines stable boundaries and evaluates mean-reversion opportunities within them.',
   'Mean reversion within confirmed boundaries.', true, true,
   '{"timeframes":["M15","H1","H4"],"indicators":["ATR","RSI"],"entry_conditions":["boundary reaction"],"exit_conditions":["range escape"],"filters":["range stability"],"risk_parameters":{}}'::jsonb,
   'H1', '["M15","H1","H4"]'::jsonb, '["forex","metals","indices"]'::jsonb, 'available', '{}'::jsonb),
  ('Breakout', 'breakout', 'Breakout',
   'Frames expansion from compressed price ranges with confirmation and risk controls.',
   'Structured expansion from compressed ranges.', true, true,
   '{"timeframes":["M15","H1","H4"],"indicators":["ATR"],"entry_conditions":["range expansion"],"exit_conditions":["failed breakout"],"filters":["volatility"],"risk_parameters":{}}'::jsonb,
   'H1', '["M15","H1","H4"]'::jsonb, '["forex","indices","crypto"]'::jsonb, 'available', '{}'::jsonb),
  ('Price Action Framework', 'price-action-framework', 'Price Action',
   'Defines strategies from market structure, levels, and candle behavior without performance claims.',
   'Market structure and candle-based definitions.', true, true,
   '{"timeframes":["M15","H1","H4"],"indicators":[],"entry_conditions":["structure and candle confirmation"],"exit_conditions":["structure invalidation"],"filters":["key levels"],"risk_parameters":{}}'::jsonb,
   'H1', '["M15","H1","H4"]'::jsonb, '["forex","metals","indices"]'::jsonb, 'available', '{}'::jsonb),
  ('NFP News Trading', 'nfp-news-trading', 'NFP News Trading',
   'Provides a definition framework for handling NFP event windows and post-release structure.',
   'NFP event-window strategy definition.', true, true,
   '{"timeframes":["M5","M15","H1"],"indicators":[],"entry_conditions":["post-release confirmation"],"exit_conditions":["event-window close"],"filters":["NFP calendar"],"risk_parameters":{}}'::jsonb,
   'M15', '["M5","M15","H1"]'::jsonb, '["forex"]'::jsonb, 'available', '{}'::jsonb),
  ('Carry', 'carry', 'Carry',
   'Organizes longer-horizon definitions around rate differentials and directional context.',
   'Rate-differential strategy definition.', true, true,
   '{"timeframes":["D1","W1"],"indicators":[],"entry_conditions":["carry context confirmation"],"exit_conditions":["rate or trend invalidation"],"filters":["macro context"],"risk_parameters":{}}'::jsonb,
   'D1', '["D1","W1"]'::jsonb, '["forex"]'::jsonb, 'available', '{}'::jsonb),
  ('Grid', 'grid', 'Grid',
   'Defines bounded level spacing for future controlled grid execution and risk configuration.',
   'Bounded level-spacing definition.', true, true,
   '{"timeframes":["M15","H1"],"indicators":["ATR"],"entry_conditions":["configured grid boundary"],"exit_conditions":["grid boundary or risk limit"],"filters":["range stability"],"risk_parameters":{}}'::jsonb,
   'H1', '["M15","H1"]'::jsonb, '["forex","indices"]'::jsonb, 'available', '{}'::jsonb),
  ('Algorithmic / HFT', 'algorithmic-hft', 'Algorithmic / HFT',
   'Documents the high-frequency definition category for future engine integrations.',
   'High-frequency algorithmic definition category.', true, true,
   '{"timeframes":["M1"],"indicators":[],"entry_conditions":["engine-defined signal"],"exit_conditions":["engine-defined exit"],"filters":["latency and spread"],"risk_parameters":{}}'::jsonb,
   'M1', '["M1"]'::jsonb, '["forex","indices"]'::jsonb, 'available', '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  short_description = EXCLUDED.short_description,
  is_active = EXCLUDED.is_active,
  is_builtin = true,
  configuration = EXCLUDED.configuration,
  timeframe = EXCLUDED.timeframe,
  timeframes = EXCLUDED.timeframes,
  markets = EXCLUDED.markets,
  status = EXCLUDED.status,
  configuration_schema = EXCLUDED.configuration_schema,
  updated_at = now();

COMMIT;

-- Verification: these results should show total=21, active=21, scalping=10.
SELECT
  count(*) AS total_strategy_records,
  count(*) FILTER (WHERE is_active) AS active_strategy_records,
  count(*) FILTER (WHERE category = 'Scalping' AND is_active) AS scalping_records,
  count(DISTINCT slug) AS distinct_slug_records
FROM public.strategies;

SELECT slug, name, category, is_active
FROM public.strategies
WHERE slug IN (
  'micro-momentum', 'momentum', 'ema-pullback', 'price-action',
  'break-retest', 'liquidity-sweep', 'vwap', 'atr-volatility',
  'session', 'range'
)
ORDER BY slug;

SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'strategies';

SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'strategies';

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'strategies'
ORDER BY indexname;
