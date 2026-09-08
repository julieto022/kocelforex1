ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS position_ticket bigint,
  ADD COLUMN IF NOT EXISTS order_ticket bigint;

CREATE INDEX IF NOT EXISTS trades_connection_position_ticket_idx
  ON public.trades (broker_connection_id, position_ticket)
  WHERE broker_connection_id IS NOT NULL AND position_ticket IS NOT NULL;