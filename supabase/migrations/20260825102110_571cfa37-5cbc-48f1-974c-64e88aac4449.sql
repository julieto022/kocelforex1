-- =========================================================
-- PHASE 2: backend foundation
-- =========================================================

-- ---------- helper: updated_at trigger already exists as public.set_updated_at()

-- ---------- PROFILES (Kocel account record) ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS profiles_status_idx ON public.profiles (status);

-- ---------- USER SESSIONS ----------
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  device text,
  browser text,
  os text,
  ip_address text,
  user_agent text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz
);

GRANT SELECT, DELETE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own sessions read" ON public.user_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own sessions revoke" ON public.user_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON public.user_sessions (user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON public.user_sessions (expires_at);

-- ---------- AUDIT LOGS ----------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own audit logs read" ON public.audit_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action);

-- ---------- RATE LIMITS (server-only) ----------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  window_seconds integer NOT NULL,
  hits integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_key, window_start)
);

GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON public.rate_limits (window_start);

-- ---------- BROKERS ----------
ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS brokers_slug_key ON public.brokers (slug);

DROP TRIGGER IF EXISTS brokers_updated_at ON public.brokers;
CREATE TRIGGER brokers_updated_at BEFORE UPDATE ON public.brokers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- BROKER CONNECTIONS ----------
ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS connection_code_hash text,
  ADD COLUMN IF NOT EXISTS connection_code_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS code_state text NOT NULL DEFAULT 'CREATED',
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS ea_version text;

CREATE INDEX IF NOT EXISTS broker_connections_user_id_idx ON public.broker_connections (user_id);
CREATE INDEX IF NOT EXISTS broker_connections_status_idx ON public.broker_connections (status);
CREATE INDEX IF NOT EXISTS broker_connections_mt5_login_idx ON public.broker_connections (mt5_login);
CREATE INDEX IF NOT EXISTS broker_connections_code_hash_idx ON public.broker_connections (connection_code_hash);

-- ---------- MARKET SYMBOLS ----------
CREATE TABLE IF NOT EXISTS public.market_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  display_name text,
  asset_class text NOT NULL DEFAULT 'forex',
  digits integer,
  point numeric,
  contract_size numeric,
  min_volume numeric,
  max_volume numeric,
  volume_step numeric,
  trade_mode text,
  status text NOT NULL DEFAULT 'enabled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_connection_id, symbol)
);

GRANT SELECT ON public.market_symbols TO authenticated;
GRANT ALL ON public.market_symbols TO service_role;
ALTER TABLE public.market_symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own market symbols read" ON public.market_symbols
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS market_symbols_connection_idx ON public.market_symbols (broker_connection_id);
CREATE INDEX IF NOT EXISTS market_symbols_symbol_idx ON public.market_symbols (symbol);

DROP TRIGGER IF EXISTS market_symbols_updated_at ON public.market_symbols;
CREATE TRIGGER market_symbols_updated_at BEFORE UPDATE ON public.market_symbols
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- BOTS ----------
ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS timeframe text,
  ADD COLUMN IF NOT EXISTS configuration jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS bots_user_id_idx ON public.bots (user_id);
CREATE INDEX IF NOT EXISTS bots_status_idx ON public.bots (status);

-- ---------- STRATEGIES ----------
ALTER TABLE public.strategies
  ADD COLUMN IF NOT EXISTS timeframes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS configuration_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS strategies_slug_key ON public.strategies (slug);

DROP TRIGGER IF EXISTS strategies_updated_at ON public.strategies;
CREATE TRIGGER strategies_updated_at BEFORE UPDATE ON public.strategies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- TRADES ----------
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS commission numeric,
  ADD COLUMN IF NOT EXISTS swap numeric,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS trades_user_id_idx ON public.trades (user_id);
CREATE INDEX IF NOT EXISTS trades_symbol_idx ON public.trades (symbol);
CREATE INDEX IF NOT EXISTS trades_opened_at_idx ON public.trades (opened_at DESC);

DROP TRIGGER IF EXISTS trades_updated_at ON public.trades;
CREATE TRIGGER trades_updated_at BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- SIGNALS ----------
ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS broker_connection_id uuid REFERENCES public.broker_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS signals_user_id_idx ON public.signals (user_id);
CREATE INDEX IF NOT EXISTS signals_symbol_idx ON public.signals (symbol);
CREATE INDEX IF NOT EXISTS signals_status_idx ON public.signals (status);

DROP TRIGGER IF EXISTS signals_updated_at ON public.signals;
CREATE TRIGGER signals_updated_at BEFORE UPDATE ON public.signals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- NEWS ----------
ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS symbols jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS news_published_at_idx ON public.news (published_at DESC);

DROP TRIGGER IF EXISTS news_updated_at ON public.news;
CREATE TRIGGER news_updated_at BEFORE UPDATE ON public.news
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- ECONOMIC EVENTS ----------
ALTER TABLE public.economic_events
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS economic_events_event_time_idx ON public.economic_events (event_time);

DROP TRIGGER IF EXISTS economic_events_updated_at ON public.economic_events;
CREATE TRIGGER economic_events_updated_at BEFORE UPDATE ON public.economic_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- NFP EVENTS ----------
CREATE TABLE IF NOT EXISTS public.nfp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_date date NOT NULL,
  release_time timestamptz NOT NULL,
  previous text,
  forecast text,
  actual text,
  surprise text,
  source text,
  status text NOT NULL DEFAULT 'SCHEDULED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (release_date)
);

GRANT SELECT ON public.nfp_events TO anon, authenticated;
GRANT ALL ON public.nfp_events TO service_role;
ALTER TABLE public.nfp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfp events readable" ON public.nfp_events
  FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS nfp_events_release_time_idx ON public.nfp_events (release_time DESC);

DROP TRIGGER IF EXISTS nfp_events_updated_at ON public.nfp_events;
CREATE TRIGGER nfp_events_updated_at BEFORE UPDATE ON public.nfp_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.nfp_predictions
  ADD COLUMN IF NOT EXISTS nfp_event_id uuid REFERENCES public.nfp_events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';

-- ---------- NOTIFICATIONS ----------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications (user_id) WHERE read = false;

-- ---------- COMMUNITY ----------
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE public.community_comments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.community_reports
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE INDEX IF NOT EXISTS community_posts_created_at_idx ON public.community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS community_comments_post_id_idx ON public.community_comments (post_id);

DROP TRIGGER IF EXISTS community_comments_updated_at ON public.community_comments;
CREATE TRIGGER community_comments_updated_at BEFORE UPDATE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- unique reaction per user/post
CREATE UNIQUE INDEX IF NOT EXISTS community_reactions_unique ON public.community_reactions (post_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS community_follows_unique ON public.community_follows (follower_id, following_id);

-- prevent self-follow
CREATE OR REPLACE FUNCTION public.prevent_self_follow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.follower_id = NEW.following_id THEN
    RAISE EXCEPTION 'A user cannot follow themselves';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS community_follows_no_self ON public.community_follows;
CREATE TRIGGER community_follows_no_self BEFORE INSERT OR UPDATE ON public.community_follows
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_follow();

-- ---------- COMMUNITY SAVES ----------
CREATE TABLE IF NOT EXISTS public.community_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

GRANT SELECT, INSERT, DELETE ON public.community_saves TO authenticated;
GRANT ALL ON public.community_saves TO service_role;
ALTER TABLE public.community_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own saves read" ON public.community_saves
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own saves insert" ON public.community_saves
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own saves delete" ON public.community_saves
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS community_saves_user_idx ON public.community_saves (user_id, created_at DESC);

-- =========================================================
-- SEED: brokers + strategy metadata only (no financial data)
-- =========================================================
INSERT INTO public.brokers (name, slug, description, status, supported, capabilities, connection_config, sort_order)
VALUES
  ('Deriv', 'deriv', 'MT5 accounts offered by Deriv. Connected through the Kocel Bridge EA.', 'supported', true,
   '["forex","metals","indices","crypto","commodities","hedging","automated_trading"]'::jsonb,
   '{"requires_server": true, "environments": ["DEMO","REAL"]}'::jsonb, 1),
  ('Exness', 'exness', 'MT5 accounts offered by Exness. Connected through the Kocel Bridge EA.', 'supported', true,
   '["forex","metals","indices","crypto","stocks","hedging","automated_trading"]'::jsonb,
   '{"requires_server": true, "environments": ["DEMO","REAL"]}'::jsonb, 2)
ON CONFLICT (slug) DO UPDATE
  SET description = EXCLUDED.description,
      capabilities = EXCLUDED.capabilities,
      connection_config = EXCLUDED.connection_config,
      sort_order = EXCLUDED.sort_order;

INSERT INTO public.strategies (name, slug, description, timeframe, timeframes, markets, status, configuration, configuration_schema)
VALUES
  ('Kocel AI Scalper', 'kocel-ai-scalper', 'Short-timeframe scalping logic driven by Kocel intelligence. Execution engine arrives in a later phase.', 'M5',
   '["M1","M5","M15"]'::jsonb, '["forex","metals","indices"]'::jsonb, 'coming_soon', '{}'::jsonb,
   '{"fields":[{"key":"max_spread","type":"number"},{"key":"risk_percent","type":"number"}]}'::jsonb),
  ('Trend Following', 'trend-following', 'Follows established directional momentum on higher timeframes.', 'H1',
   '["M30","H1","H4","D1"]'::jsonb, '["forex","indices","commodities"]'::jsonb, 'available', '{}'::jsonb,
   '{"fields":[{"key":"trend_period","type":"number"},{"key":"risk_percent","type":"number"}]}'::jsonb),
  ('EMA Crossover', 'ema-crossover', 'Enters when fast and slow exponential moving averages cross.', 'M15',
   '["M15","M30","H1"]'::jsonb, '["forex","metals"]'::jsonb, 'available', '{}'::jsonb,
   '{"fields":[{"key":"fast_period","type":"number"},{"key":"slow_period","type":"number"}]}'::jsonb),
  ('Breakout', 'breakout', 'Trades range breakouts with volatility confirmation.', 'H1',
   '["M30","H1","H4"]'::jsonb, '["forex","indices","crypto"]'::jsonb, 'available', '{}'::jsonb,
   '{"fields":[{"key":"range_bars","type":"number"},{"key":"buffer_points","type":"number"}]}'::jsonb),
  ('Support & Resistance', 'support-resistance', 'Reacts to tested support and resistance zones.', 'H4',
   '["H1","H4","D1"]'::jsonb, '["forex","metals","indices"]'::jsonb, 'available', '{}'::jsonb,
   '{"fields":[{"key":"lookback","type":"number"},{"key":"zone_tolerance","type":"number"}]}'::jsonb)
ON CONFLICT (slug) DO UPDATE
  SET description = EXCLUDED.description,
      timeframes = EXCLUDED.timeframes,
      markets = EXCLUDED.markets,
      configuration_schema = EXCLUDED.configuration_schema;