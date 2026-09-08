CREATE TABLE IF NOT EXISTS public.trading_risk_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  max_lot_size numeric NOT NULL DEFAULT 1,
  max_open_positions integer NOT NULL DEFAULT 10,
  max_positions_per_symbol integer NOT NULL DEFAULT 3,
  max_daily_loss numeric,
  max_daily_loss_percent numeric,
  max_trade_risk_percent numeric,
  minimum_free_margin numeric NOT NULL DEFAULT 0,
  maximum_margin_usage_percent numeric NOT NULL DEFAULT 80,
  require_stop_loss boolean NOT NULL DEFAULT false,
  manual_trading_enabled boolean NOT NULL DEFAULT true,
  emergency_stop_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connection_id),
  CHECK (max_lot_size > 0),
  CHECK (max_open_positions > 0),
  CHECK (max_positions_per_symbol > 0),
  CHECK (max_daily_loss IS NULL OR max_daily_loss >= 0),
  CHECK (max_daily_loss_percent IS NULL OR (max_daily_loss_percent >= 0 AND max_daily_loss_percent <= 100)),
  CHECK (max_trade_risk_percent IS NULL OR (max_trade_risk_percent >= 0 AND max_trade_risk_percent <= 100)),
  CHECK (minimum_free_margin >= 0),
  CHECK (maximum_margin_usage_percent >= 0 AND maximum_margin_usage_percent <= 100)
);

ALTER TABLE public.mt5_trade_commands
  DROP CONSTRAINT IF EXISTS mt5_trade_commands_operation_check;
ALTER TABLE public.mt5_trade_commands
  ADD CONSTRAINT mt5_trade_commands_operation_check
  CHECK (operation IN ('OPEN_MARKET', 'CLOSE_POSITION', 'MODIFY_POSITION', 'PARTIAL_CLOSE', 'MOVE_TO_BREAK_EVEN', 'CANCEL_PENDING_ORDER'));

ALTER TABLE public.trading_risk_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trading_risk_settings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.trading_risk_settings TO authenticated;
GRANT ALL ON public.trading_risk_settings TO service_role;

DROP POLICY IF EXISTS trading_risk_settings_owner_read ON public.trading_risk_settings;
CREATE POLICY trading_risk_settings_owner_read ON public.trading_risk_settings
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.broker_connections connection
      WHERE connection.id = connection_id AND connection.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS trading_risk_settings_owner_write ON public.trading_risk_settings;
CREATE POLICY trading_risk_settings_owner_write ON public.trading_risk_settings
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.broker_connections connection
      WHERE connection.id = connection_id AND connection.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.broker_connections connection
      WHERE connection.id = connection_id AND connection.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS trading_risk_settings_connection_idx
  ON public.trading_risk_settings (connection_id);

DROP TRIGGER IF EXISTS trading_risk_settings_updated_at ON public.trading_risk_settings;
CREATE TRIGGER trading_risk_settings_updated_at
  BEFORE UPDATE ON public.trading_risk_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();