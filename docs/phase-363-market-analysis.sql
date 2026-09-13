-- Kocel Forex Hub - Phase 3.6.3
-- Strategy Engine & Market Analysis
--
-- Run this complete script in the Supabase SQL Editor for the current Kocel
-- project. It is additive and idempotent. It does not create orders, call
-- MT5 execution functions, or modify existing trades.
--
-- Prerequisites:
--   - Phase 3.6.1 strategy library migration
--   - Phase 3.6.2 bot management migration
--   - Phase 3.3/3.4 broker connection and Bridge session migrations
--
-- Data flow enabled by this migration:
--   Bridge EA -> market_candles / market_ticks -> strategy engine
--   strategy engine -> strategy_analysis / existing signals table

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Strategy metadata
-- ---------------------------------------------------------------------------
-- Kocel-owned strategies are read-only to normal authenticated users.
-- Activate the AI Scalper without changing its stable ID or slug.

-- Add an internal version field where older strategy schemas do not have it.
ALTER TABLE public.strategies
  ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '1.0';

UPDATE public.strategies
SET is_active = true,
    is_builtin = true,
    status = 'available',
    version = COALESCE(NULLIF(version, ''), '1.0'),
    updated_at = now()
WHERE slug = 'kocel-ai-scalper';

INSERT INTO public.strategies
  (name, slug, category, description, short_description, is_active,
   is_builtin, version, configuration, timeframe, timeframes, markets,
   status, configuration_schema)
VALUES
  (
    'Kocel AI Scalper',
    'kocel-ai-scalper',
    'Scalping',
    'Deterministic multi-factor analysis for short-timeframe market conditions. Execution remains outside Phase 3.6.3.',
    'Transparent multi-factor scalping analysis.',
    true,
    true,
    '1.0',
    '{
      "analysis_version": "1.0",
      "weights": {
        "trend": 20,
        "momentum": 20,
        "structure": 20,
        "volatility": 15,
        "price_action": 15,
        "session": 10
      },
      "minimum_confidence": 60,
      "required_confirmation": 2
    }'::jsonb,
    'M5',
    '["M1", "M5", "M15"]'::jsonb,
    '["forex", "metals", "indices"]'::jsonb,
    'available',
    '{
      "fields": [
        {"key": "minimum_confidence", "type": "number", "min": 0, "max": 100},
        {"key": "max_spread", "type": "number", "min": 0}
      ]
    }'::jsonb
  )
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    short_description = EXCLUDED.short_description,
    is_active = true,
    is_builtin = true,
    version = EXCLUDED.version,
    configuration = EXCLUDED.configuration,
    timeframe = EXCLUDED.timeframe,
    timeframes = EXCLUDED.timeframes,
    markets = EXCLUDED.markets,
    status = EXCLUDED.status,
    configuration_schema = EXCLUDED.configuration_schema,
    updated_at = now();

CREATE INDEX IF NOT EXISTS strategies_active_slug_idx
  ON public.strategies (slug)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- 2. Real Bridge-provided candle storage
-- ---------------------------------------------------------------------------
-- The Bridge/service role inserts these rows. Authenticated users can only
-- read rows belonging to their own connection/user. No generated candles are
-- inserted by this migration.

CREATE TABLE IF NOT EXISTS public.market_candles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  timeframe text NOT NULL,
  timestamp timestamptz NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  volume numeric,
  source text NOT NULL DEFAULT 'MT5_BRIDGE',
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT market_candles_timeframe_check
    CHECK (timeframe IN ('M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1')),
  CONSTRAINT market_candles_symbol_check
    CHECK (char_length(trim(symbol)) >= 1 AND char_length(symbol) <= 64),
  CONSTRAINT market_candles_prices_check
    CHECK (open >= 0 AND high >= 0 AND low >= 0 AND close >= 0),
  CONSTRAINT market_candles_ohlc_check
    CHECK (high >= open AND high >= close AND low <= open AND low <= close AND low <= high),
  CONSTRAINT market_candles_volume_check
    CHECK (volume IS NULL OR volume >= 0),
  CONSTRAINT market_candles_unique_point
    UNIQUE (broker_connection_id, symbol, timeframe, timestamp)
);

CREATE INDEX IF NOT EXISTS market_candles_lookup_idx
  ON public.market_candles (broker_connection_id, symbol, timeframe, timestamp DESC);

CREATE INDEX IF NOT EXISTS market_candles_user_lookup_idx
  ON public.market_candles (user_id, symbol, timeframe, timestamp DESC);

CREATE INDEX IF NOT EXISTS market_candles_received_idx
  ON public.market_candles (broker_connection_id, received_at DESC);

ALTER TABLE public.market_candles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.market_candles TO authenticated;
GRANT ALL ON TABLE public.market_candles TO service_role;

DROP POLICY IF EXISTS market_candles_owner_select ON public.market_candles;
CREATE POLICY market_candles_owner_select
  ON public.market_candles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Optional real tick storage
-- ---------------------------------------------------------------------------
-- Ticks are stored only when the Bridge/provider supplies them. The current
-- candle-based engine does not manufacture tick values when this table is
-- empty.

CREATE TABLE IF NOT EXISTS public.market_ticks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  timestamp timestamptz NOT NULL,
  bid numeric NOT NULL,
  ask numeric NOT NULL,
  last numeric,
  volume numeric,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT market_ticks_symbol_check
    CHECK (char_length(trim(symbol)) >= 1 AND char_length(symbol) <= 64),
  CONSTRAINT market_ticks_prices_check
    CHECK (bid >= 0 AND ask >= 0 AND (last IS NULL OR last >= 0)),
  CONSTRAINT market_ticks_spread_check
    CHECK (ask >= bid),
  CONSTRAINT market_ticks_volume_check
    CHECK (volume IS NULL OR volume >= 0),
  CONSTRAINT market_ticks_unique_point
    UNIQUE (broker_connection_id, symbol, timestamp)
);

CREATE INDEX IF NOT EXISTS market_ticks_lookup_idx
  ON public.market_ticks (broker_connection_id, symbol, timestamp DESC);

ALTER TABLE public.market_ticks ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.market_ticks TO authenticated;
GRANT ALL ON TABLE public.market_ticks TO service_role;

DROP POLICY IF EXISTS market_ticks_owner_select ON public.market_ticks;
CREATE POLICY market_ticks_owner_select
  ON public.market_ticks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Analysis history
-- ---------------------------------------------------------------------------
-- This table stores analysis results, not execution commands. The engine may
-- write through a server-side service role. Users can read only their own bot
-- analysis. Retention/cleanup can be scheduled later to avoid tick-by-tick
-- database growth.

CREATE TABLE IF NOT EXISTS public.strategy_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  strategy_id uuid NOT NULL REFERENCES public.strategies(id) ON DELETE RESTRICT,
  broker_connection_id uuid REFERENCES public.broker_connections(id) ON DELETE SET NULL,
  symbol text NOT NULL,
  timeframe text NOT NULL,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  data_timestamp timestamptz,
  data_status text NOT NULL DEFAULT 'UNAVAILABLE',
  signal_state text NOT NULL DEFAULT 'DATA_UNAVAILABLE',
  direction text NOT NULL DEFAULT 'NONE',
  confidence numeric NOT NULL DEFAULT 0,
  entry_price numeric,
  stop_loss numeric,
  take_profit numeric,
  market_state text NOT NULL DEFAULT 'UNCLEAR',
  reason text NOT NULL,
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  indicator_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  strategy_version text NOT NULL DEFAULT '1.0',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT strategy_analysis_data_status_check
    CHECK (data_status IN ('FRESH', 'STALE', 'UNAVAILABLE')),
  CONSTRAINT strategy_analysis_state_check
    CHECK (signal_state IN ('NO_SIGNAL', 'BUY', 'SELL', 'WAIT', 'INSUFFICIENT_DATA', 'DATA_UNAVAILABLE', 'STRATEGY_UNAVAILABLE', 'MARKET_UNSUITABLE')),
  CONSTRAINT strategy_analysis_direction_check
    CHECK (direction IN ('BUY', 'SELL', 'NONE')),
  CONSTRAINT strategy_analysis_confidence_check
    CHECK (confidence >= 0 AND confidence <= 100),
  CONSTRAINT strategy_analysis_symbol_check
    CHECK (char_length(trim(symbol)) >= 1 AND char_length(symbol) <= 64),
  CONSTRAINT strategy_analysis_timeframe_check
    CHECK (timeframe IN ('M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1')),
  CONSTRAINT strategy_analysis_market_state_check
    CHECK (market_state IN ('TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'BREAKOUT', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'UNCLEAR'))
);

CREATE INDEX IF NOT EXISTS strategy_analysis_bot_time_idx
  ON public.strategy_analysis (bot_id, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS strategy_analysis_user_time_idx
  ON public.strategy_analysis (user_id, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS strategy_analysis_symbol_time_idx
  ON public.strategy_analysis (symbol, timeframe, analyzed_at DESC);

ALTER TABLE public.strategy_analysis ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.strategy_analysis TO authenticated;
GRANT ALL ON TABLE public.strategy_analysis TO service_role;

DROP POLICY IF EXISTS strategy_analysis_owner_select ON public.strategy_analysis;
CREATE POLICY strategy_analysis_owner_select
  ON public.strategy_analysis
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Extend the existing signal table without duplicating it
-- ---------------------------------------------------------------------------
-- Existing UI/services already use public.signals. These nullable columns keep
-- old signal rows valid while allowing new engine results to identify their bot
-- and strategy.

ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS bot_id uuid REFERENCES public.bots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS strategy_id uuid REFERENCES public.strategies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS market_state text,
  ADD COLUMN IF NOT EXISTS data_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS data_status text NOT NULL DEFAULT 'UNAVAILABLE',
  ADD COLUMN IF NOT EXISTS strategy_version text NOT NULL DEFAULT '1.0';

CREATE INDEX IF NOT EXISTS signals_bot_created_idx
  ON public.signals (bot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS signals_strategy_created_idx
  ON public.signals (strategy_id, created_at DESC);

-- Preserve existing signal RLS policies. Add only an owner read policy if the
-- existing schema has no equivalent policy.
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.signals TO authenticated;
GRANT ALL ON TABLE public.signals TO service_role;

DROP POLICY IF EXISTS signals_owner_select ON public.signals;
CREATE POLICY signals_owner_select
  ON public.signals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. Retention helper
-- ---------------------------------------------------------------------------
-- This function is intentionally not scheduled here. It can be called by a
-- trusted scheduled job after choosing a retention period appropriate to the
-- deployment.

CREATE OR REPLACE FUNCTION public.cleanup_strategy_market_data(
  _before timestamptz,
  _max_candles integer DEFAULT 1000000,
  _max_ticks integer DEFAULT 1000000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_candles integer := 0;
  deleted_ticks integer := 0;
BEGIN
  IF _before IS NULL OR _max_candles < 0 OR _max_ticks < 0 THEN
    RAISE EXCEPTION 'Invalid cleanup arguments';
  END IF;

  DELETE FROM public.market_candles
  WHERE timestamp < _before
    AND id IN (
      SELECT id
      FROM public.market_candles
      WHERE timestamp < _before
      ORDER BY timestamp ASC
      LIMIT _max_candles
    );
  GET DIAGNOSTICS deleted_candles = ROW_COUNT;

  DELETE FROM public.market_ticks
  WHERE timestamp < _before
    AND id IN (
      SELECT id
      FROM public.market_ticks
      WHERE timestamp < _before
      ORDER BY timestamp ASC
      LIMIT _max_ticks
    );
  GET DIAGNOSTICS deleted_ticks = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_candles', deleted_candles,
    'deleted_ticks', deleted_ticks,
    'before', _before
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_strategy_market_data(timestamptz, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_strategy_market_data(timestamptz, integer, integer) TO service_role;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification queries
-- ---------------------------------------------------------------------------
SELECT
  'market_candles' AS table_name,
  to_regclass('public.market_candles') IS NOT NULL AS exists,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'market_candles';

SELECT
  'market_ticks' AS table_name,
  to_regclass('public.market_ticks') IS NOT NULL AS exists,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'market_ticks';

SELECT
  'strategy_analysis' AS table_name,
  to_regclass('public.strategy_analysis') IS NOT NULL AS exists,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'strategy_analysis';

SELECT slug, name, is_active, is_builtin, version, status
FROM public.strategies
WHERE slug = 'kocel-ai-scalper';

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('market_candles', 'market_ticks', 'strategy_analysis', 'signals')
ORDER BY tablename, indexname;

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('market_candles', 'market_ticks', 'strategy_analysis', 'signals')
ORDER BY tablename, policyname;
