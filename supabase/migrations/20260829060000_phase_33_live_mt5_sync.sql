ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS balance numeric,
  ADD COLUMN IF NOT EXISTS equity numeric,
  ADD COLUMN IF NOT EXISTS credit numeric,
  ADD COLUMN IF NOT EXISTS margin numeric,
  ADD COLUMN IF NOT EXISTS free_margin numeric,
  ADD COLUMN IF NOT EXISTS margin_level numeric,
  ADD COLUMN IF NOT EXISTS profit numeric,
  ADD COLUMN IF NOT EXISTS account_status text,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

CREATE TABLE IF NOT EXISTS public.mt5_account_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  mt5_login text NOT NULL,
  status text NOT NULL DEFAULT 'CONNECTED',
  balance numeric NOT NULL,
  equity numeric NOT NULL,
  credit numeric NOT NULL DEFAULT 0,
  margin numeric NOT NULL DEFAULT 0,
  free_margin numeric NOT NULL DEFAULT 0,
  margin_level numeric,
  profit numeric NOT NULL DEFAULT 0,
  currency text NOT NULL,
  leverage integer,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mt5_open_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  mt5_login text NOT NULL,
  ticket bigint NOT NULL,
  symbol text NOT NULL,
  direction text NOT NULL,
  volume numeric NOT NULL,
  open_price numeric NOT NULL,
  current_price numeric NOT NULL,
  stop_loss numeric,
  take_profit numeric,
  current_profit numeric NOT NULL DEFAULT 0,
  swap numeric NOT NULL DEFAULT 0,
  magic_number bigint,
  opened_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_connection_id, ticket)
);

CREATE TABLE IF NOT EXISTS public.mt5_pending_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  mt5_login text NOT NULL,
  ticket bigint NOT NULL,
  symbol text NOT NULL,
  order_type text NOT NULL,
  volume numeric NOT NULL,
  price numeric NOT NULL,
  stop_loss numeric,
  take_profit numeric,
  state text NOT NULL,
  magic_number bigint,
  created_at timestamptz NOT NULL,
  UNIQUE (broker_connection_id, ticket)
);

ALTER TABLE public.mt5_account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt5_open_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt5_pending_orders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.mt5_account_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.mt5_open_positions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.mt5_pending_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mt5_account_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mt5_open_positions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mt5_pending_orders TO service_role;
GRANT SELECT ON public.mt5_account_snapshots TO authenticated;
GRANT SELECT ON public.mt5_open_positions TO authenticated;
GRANT SELECT ON public.mt5_pending_orders TO authenticated;

CREATE POLICY "mt5_account_snapshots_owner_read" ON public.mt5_account_snapshots
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "mt5_open_positions_owner_read" ON public.mt5_open_positions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "mt5_pending_orders_owner_read" ON public.mt5_pending_orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS mt5_account_snapshots_connection_idx ON public.mt5_account_snapshots (broker_connection_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS mt5_account_snapshots_user_idx ON public.mt5_account_snapshots (user_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS mt5_open_positions_connection_idx ON public.mt5_open_positions (broker_connection_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS mt5_pending_orders_connection_idx ON public.mt5_pending_orders (broker_connection_id, created_at DESC);
