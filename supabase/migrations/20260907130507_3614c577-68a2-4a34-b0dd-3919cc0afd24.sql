-- De-duplicate any existing rows before adding unique constraints
DELETE FROM public.mt5_open_positions a
USING public.mt5_open_positions b
WHERE a.broker_connection_id = b.broker_connection_id
  AND a.ticket = b.ticket
  AND a.ctid < b.ctid;

DELETE FROM public.mt5_pending_orders a
USING public.mt5_pending_orders b
WHERE a.broker_connection_id = b.broker_connection_id
  AND a.ticket = b.ticket
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS mt5_open_positions_connection_ticket_key
  ON public.mt5_open_positions (broker_connection_id, ticket);

CREATE UNIQUE INDEX IF NOT EXISTS mt5_pending_orders_connection_ticket_key
  ON public.mt5_pending_orders (broker_connection_id, ticket);

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS deal_ticket bigint,
  ADD COLUMN IF NOT EXISTS net_profit numeric,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'MT5';

DELETE FROM public.trades a
USING public.trades b
WHERE a.broker_connection_id IS NOT NULL
  AND a.broker_connection_id = b.broker_connection_id
  AND a.ticket IS NOT NULL
  AND a.ticket = b.ticket
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS trades_connection_ticket_key
  ON public.trades (broker_connection_id, ticket)
  WHERE broker_connection_id IS NOT NULL AND ticket IS NOT NULL;

CREATE INDEX IF NOT EXISTS trades_user_closed_at_idx
  ON public.trades (user_id, closed_at DESC);