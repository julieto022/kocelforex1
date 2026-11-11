ALTER TABLE public.mcp_api_keys
  ADD COLUMN IF NOT EXISTS can_trade_directly boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Authenticated users can read active strategies" ON public.strategies;
DROP POLICY IF EXISTS strategies_owner_select ON public.strategies;
CREATE POLICY strategies_owner_select
  ON public.strategies
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (is_builtin = true OR user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.strategy_user_overrides (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id uuid NOT NULL REFERENCES public.strategies(id) ON DELETE CASCADE,
  name_override text,
  description_override text,
  short_description_override text,
  category_override text,
  configuration_override jsonb,
  is_hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, strategy_id),
  CHECK (name_override IS NULL OR char_length(trim(name_override)) BETWEEN 2 AND 80),
  CHECK (description_override IS NULL OR char_length(description_override) <= 4000),
  CHECK (short_description_override IS NULL OR char_length(short_description_override) <= 240),
  CHECK (category_override IS NULL OR char_length(trim(category_override)) BETWEEN 1 AND 60)
);

ALTER TABLE public.strategy_user_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.strategy_user_overrides FROM PUBLIC, anon;
GRANT SELECT ON public.strategy_user_overrides TO authenticated;
GRANT ALL ON public.strategy_user_overrides TO service_role;
DROP POLICY IF EXISTS strategy_user_overrides_owner_select ON public.strategy_user_overrides;
CREATE POLICY strategy_user_overrides_owner_select
  ON public.strategy_user_overrides
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.backtest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  strategy_id uuid REFERENCES public.strategies(id) ON DELETE SET NULL,
  strategy_name text NOT NULL,
  symbol text NOT NULL,
  timeframe text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  candle_count integer NOT NULL CHECK (candle_count >= 0),
  engine_version text NOT NULL,
  settings jsonb NOT NULL,
  metrics jsonb NOT NULL,
  equity_curve jsonb NOT NULL,
  trades jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS backtest_runs_owner_created_idx
  ON public.backtest_runs (user_id, connection_id, created_at DESC);
ALTER TABLE public.backtest_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backtest_runs FROM PUBLIC, anon;
GRANT SELECT ON public.backtest_runs TO authenticated;
GRANT ALL ON public.backtest_runs TO service_role;
DROP POLICY IF EXISTS backtest_runs_owner_select ON public.backtest_runs;
CREATE POLICY backtest_runs_owner_select
  ON public.backtest_runs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
