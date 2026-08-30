ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS balance numeric,
  ADD COLUMN IF NOT EXISTS equity numeric,
  ADD COLUMN IF NOT EXISTS credit numeric,
  ADD COLUMN IF NOT EXISTS margin numeric,
  ADD COLUMN IF NOT EXISTS free_margin numeric,
  ADD COLUMN IF NOT EXISTS margin_level numeric,
  ADD COLUMN IF NOT EXISTS profit numeric,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

CREATE TABLE IF NOT EXISTS public.mt5_account_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  mt5_login text NOT NULL,
  status text NOT NULL DEFAULT 'CONNECTED',
  balance numeric,
  equity numeric,
  credit numeric,
  margin numeric,
  free_margin numeric,
  margin_level numeric,
  profit numeric,
  currency text,
  leverage integer,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mt5_account_snapshots TO authenticated;
GRANT ALL ON public.mt5_account_snapshots TO service_role;
ALTER TABLE public.mt5_account_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own mt5 snapshots" ON public.mt5_account_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS mt5_account_snapshots_conn_time_idx
  ON public.mt5_account_snapshots (broker_connection_id, snapshot_at DESC);

CREATE TABLE IF NOT EXISTS public.mt5_open_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  mt5_login text NOT NULL,
  ticket bigint NOT NULL,
  symbol text NOT NULL,
  direction text NOT NULL,
  volume numeric NOT NULL,
  open_price numeric,
  current_price numeric,
  stop_loss numeric,
  take_profit numeric,
  current_profit numeric,
  swap numeric,
  magic_number bigint,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_connection_id, ticket)
);
GRANT SELECT ON public.mt5_open_positions TO authenticated;
GRANT ALL ON public.mt5_open_positions TO service_role;
ALTER TABLE public.mt5_open_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own mt5 positions" ON public.mt5_open_positions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS mt5_open_positions_conn_idx
  ON public.mt5_open_positions (broker_connection_id);

CREATE TABLE IF NOT EXISTS public.mt5_pending_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  mt5_login text NOT NULL,
  ticket bigint NOT NULL,
  symbol text NOT NULL,
  order_type text NOT NULL,
  volume numeric NOT NULL,
  price numeric,
  stop_loss numeric,
  take_profit numeric,
  state text,
  magic_number bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_connection_id, ticket)
);
GRANT SELECT ON public.mt5_pending_orders TO authenticated;
GRANT ALL ON public.mt5_pending_orders TO service_role;
ALTER TABLE public.mt5_pending_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own mt5 orders" ON public.mt5_pending_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS mt5_pending_orders_conn_idx
  ON public.mt5_pending_orders (broker_connection_id);