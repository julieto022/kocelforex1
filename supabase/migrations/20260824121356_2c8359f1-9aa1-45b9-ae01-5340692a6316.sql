-- helper: updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  username TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  country TEXT,
  avatar_url TEXT,
  referral_code TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BROKERS
CREATE TABLE public.brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo TEXT,
  status TEXT NOT NULL DEFAULT 'supported',
  supported BOOLEAN NOT NULL DEFAULT true,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  connection_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brokers TO anon, authenticated;
GRANT ALL ON public.brokers TO service_role;
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brokers readable" ON public.brokers FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.brokers (name, slug, status, supported, capabilities, connection_config, sort_order) VALUES
 ('Deriv MT5','deriv-mt5','supported',true,'["Forex","Metals","Indices","Crypto CFD","Hedging","Automated trading"]','{"server_hint":"DerivSVG-Server","requires_server":true}',1),
 ('Exness MT5','exness-mt5','supported',true,'["Forex","Metals","Indices","Stocks","Hedging","Automated trading"]','{"server_hint":"Exness-MT5Real","requires_server":true}',2),
 ('Other MT5 Broker','other-mt5','manual',false,'["Forex","Metals","Indices"]','{"manual":true,"requires_server":true}',3),
 ('More Coming Soon','coming-soon','coming_soon',false,'[]','{}',4);

-- USER SETTINGS
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  language TEXT NOT NULL DEFAULT 'en',
  date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
  default_currency TEXT NOT NULL DEFAULT 'USD',
  default_risk_profile TEXT NOT NULL DEFAULT 'balanced',
  active_connection_id UUID,
  notifications JSONB NOT NULL DEFAULT '{"trade":true,"bot":true,"connection":true,"risk":true,"email":false,"push":false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BROKER CONNECTIONS
CREATE TABLE public.broker_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES public.brokers(id),
  account_name TEXT NOT NULL,
  nickname TEXT,
  mt5_login TEXT NOT NULL,
  server TEXT NOT NULL,
  account_type TEXT,
  environment TEXT NOT NULL DEFAULT 'demo',
  status TEXT NOT NULL DEFAULT 'WAITING_FOR_BRIDGE',
  connection_code TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_connections TO authenticated;
GRANT ALL ON public.broker_connections TO service_role;
ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own connections" ON public.broker_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER broker_connections_updated_at BEFORE UPDATE ON public.broker_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STRATEGIES
CREATE TABLE public.strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  timeframe TEXT,
  markets JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'available',
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.strategies TO anon, authenticated;
GRANT ALL ON public.strategies TO service_role;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strategies readable" ON public.strategies FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.strategies (name, slug, description, timeframe, markets, status) VALUES
 ('Kocel AI Scalper','ai-scalper','Short-term scalping logic driven by the Kocel analysis engine.','M1 - M15','["Forex","Metals"]','preview'),
 ('Trend Following','trend-following','Follows established directional momentum with trailing exits.','H1 - H4','["Forex","Indices"]','available'),
 ('EMA Crossover','ema-crossover','Classic moving average crossover entries with confirmation filters.','M15 - H1','["Forex"]','available'),
 ('Breakout','breakout','Trades range breakouts with volatility-based stops.','M30 - H4','["Indices","Metals"]','available'),
 ('Support & Resistance','support-resistance','Reaction entries at mapped key levels.','H1 - D1','["Forex","Metals"]','available'),
 ('Custom Strategy','custom','Build your own rule set from Kocel strategy blocks.','Any','["Any"]','preview');

-- BOTS
CREATE TABLE public.bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  broker_connection_id UUID REFERENCES public.broker_connections(id) ON DELETE SET NULL,
  strategy_id UUID REFERENCES public.strategies(id),
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  risk_profile TEXT NOT NULL DEFAULT 'balanced',
  status TEXT NOT NULL DEFAULT 'stopped',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bots TO authenticated;
GRANT ALL ON public.bots TO service_role;
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bots" ON public.bots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER bots_updated_at BEFORE UPDATE ON public.bots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TRADES
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  broker_connection_id UUID REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES public.bots(id) ON DELETE SET NULL,
  ticket TEXT,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  volume NUMERIC,
  entry_price NUMERIC,
  exit_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  profit NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own trades" ON public.trades FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, email, phone, country, referral_code)
  VALUES (NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'username',
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'country',
    NEW.raw_user_meta_data->>'referral_code')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();