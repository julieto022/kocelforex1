-- Phase 3.6.3: analysis history and optional real tick storage.
-- Additive and idempotent. No execution commands or trades are created.

BEGIN;

ALTER TABLE public.strategies
  ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '1.0';

UPDATE public.strategies
SET is_active = true,
    is_builtin = true,
    version = COALESCE(NULLIF(version, ''), '1.0'),
    status = 'available',
    updated_at = now()
WHERE slug = 'kocel-ai-scalper';

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
  CONSTRAINT market_ticks_symbol_check CHECK (char_length(trim(symbol)) BETWEEN 1 AND 64),
  CONSTRAINT market_ticks_prices_check CHECK (bid >= 0 AND ask >= bid AND (last IS NULL OR last >= 0)),
  CONSTRAINT market_ticks_volume_check CHECK (volume IS NULL OR volume >= 0),
  CONSTRAINT market_ticks_unique_point UNIQUE (broker_connection_id, symbol, timestamp)
);

CREATE INDEX IF NOT EXISTS market_ticks_lookup_idx
  ON public.market_ticks (broker_connection_id, symbol, timestamp DESC);

ALTER TABLE public.market_ticks ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.market_ticks TO authenticated;
GRANT ALL ON public.market_ticks TO service_role;
DROP POLICY IF EXISTS market_ticks_owner_select ON public.market_ticks;
CREATE POLICY market_ticks_owner_select
  ON public.market_ticks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

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
  CONSTRAINT strategy_analysis_timeframe_check CHECK (timeframe IN ('M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1')),
  CONSTRAINT strategy_analysis_data_status_check CHECK (data_status IN ('FRESH', 'STALE', 'UNAVAILABLE')),
  CONSTRAINT strategy_analysis_state_check CHECK (signal_state IN ('NO_SIGNAL', 'BUY', 'SELL', 'WAIT', 'INSUFFICIENT_DATA', 'DATA_UNAVAILABLE', 'STRATEGY_UNAVAILABLE', 'MARKET_UNSUITABLE')),
  CONSTRAINT strategy_analysis_direction_check CHECK (direction IN ('BUY', 'SELL', 'NONE')),
  CONSTRAINT strategy_analysis_confidence_check CHECK (confidence BETWEEN 0 AND 100),
  CONSTRAINT strategy_analysis_market_state_check CHECK (market_state IN ('TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'BREAKOUT', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'UNCLEAR'))
);

CREATE INDEX IF NOT EXISTS strategy_analysis_bot_time_idx
  ON public.strategy_analysis (bot_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS strategy_analysis_user_time_idx
  ON public.strategy_analysis (user_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS strategy_analysis_symbol_time_idx
  ON public.strategy_analysis (symbol, timeframe, analyzed_at DESC);

ALTER TABLE public.strategy_analysis ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.strategy_analysis TO authenticated;
GRANT ALL ON public.strategy_analysis TO service_role;
DROP POLICY IF EXISTS strategy_analysis_owner_select ON public.strategy_analysis;
CREATE POLICY strategy_analysis_owner_select
  ON public.strategy_analysis FOR SELECT TO authenticated
  USING (user_id = auth.uid());

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

COMMIT;
