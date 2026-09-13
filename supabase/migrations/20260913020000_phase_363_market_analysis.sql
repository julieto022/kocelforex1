-- Phase 3.6.3: real Bridge-provided candle storage for analysis.
-- The Bridge/service role writes rows; users can only read their own connection data.
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
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_connection_id, symbol, timeframe, timestamp),
  CHECK (open >= 0 AND high >= 0 AND low >= 0 AND close >= 0),
  CHECK (high >= open AND high >= close AND low <= open AND low <= close AND low <= high)
);

CREATE INDEX IF NOT EXISTS market_candles_lookup_idx
  ON public.market_candles (broker_connection_id, symbol, timeframe, timestamp DESC);
ALTER TABLE public.market_candles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.market_candles TO authenticated;
GRANT ALL ON public.market_candles TO service_role;
DROP POLICY IF EXISTS market_candles_owner_select ON public.market_candles;
CREATE POLICY market_candles_owner_select ON public.market_candles
  FOR SELECT TO authenticated USING (user_id = auth.uid());