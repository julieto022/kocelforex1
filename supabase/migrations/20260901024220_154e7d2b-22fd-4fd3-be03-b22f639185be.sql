-- Phase 3.4: MT5 Trade Execution Foundation
-- Secure trade command lifecycle: PENDING → SENT → EXECUTING → EXECUTED/FAILED

CREATE TABLE IF NOT EXISTS public.mt5_trade_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  client_request_id uuid NOT NULL,
  
  -- Operation type: OPEN_MARKET, CLOSE_POSITION, MODIFY_POSITION, CANCEL_PENDING_ORDER
  operation text NOT NULL CHECK (operation IN ('OPEN_MARKET', 'CLOSE_POSITION', 'MODIFY_POSITION', 'CANCEL_PENDING_ORDER')),
  
  -- Request parameters (stored as sent by user)
  symbol text,
  side text CHECK (side IS NULL OR side IN ('BUY', 'SELL')),
  requested_volume numeric,
  requested_price numeric,
  requested_stop_loss numeric,
  requested_take_profit numeric,
  position_ticket bigint,
  order_ticket bigint,
  
  -- Execution status tracking
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'EXECUTING', 'EXECUTED', 'FAILED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
  
  -- MT5 Execution Result
  mt5_ticket bigint,
  mt5_deal_ticket bigint,
  executed_volume numeric,
  executed_price numeric,
  executed_at timestamptz,
  
  -- Error tracking
  error_code text,
  error_message text,
  
  -- Timestamps
  requested_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure one execution per client request ID per connection
  UNIQUE (connection_id, client_request_id)
);

-- Grant permissions
GRANT SELECT ON public.mt5_trade_commands TO authenticated;
GRANT ALL ON public.mt5_trade_commands TO service_role;

-- Row Level Security
ALTER TABLE public.mt5_trade_commands ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own commands
DROP POLICY IF EXISTS "Users read own trade commands" ON public.mt5_trade_commands;
CREATE POLICY "Users read own trade commands" ON public.mt5_trade_commands
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own trade commands" ON public.mt5_trade_commands;
CREATE POLICY "Users update own trade commands" ON public.mt5_trade_commands
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own trade commands" ON public.mt5_trade_commands;
CREATE POLICY "Users insert own trade commands" ON public.mt5_trade_commands
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Service role has full access for bridge operations
DROP POLICY IF EXISTS "Service role has full access" ON public.mt5_trade_commands;
CREATE POLICY "Service role has full access" ON public.mt5_trade_commands
  FOR ALL TO service_role USING (true);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS mt5_trade_commands_user_id_idx
  ON public.mt5_trade_commands (user_id);

CREATE INDEX IF NOT EXISTS mt5_trade_commands_connection_id_idx
  ON public.mt5_trade_commands (connection_id);

CREATE INDEX IF NOT EXISTS mt5_trade_commands_client_request_id_idx
  ON public.mt5_trade_commands (client_request_id);

CREATE INDEX IF NOT EXISTS mt5_trade_commands_status_idx
  ON public.mt5_trade_commands (status);

CREATE INDEX IF NOT EXISTS mt5_trade_commands_created_at_idx
  ON public.mt5_trade_commands (created_at DESC);

CREATE INDEX IF NOT EXISTS mt5_trade_commands_expires_at_idx
  ON public.mt5_trade_commands (expires_at);

CREATE INDEX IF NOT EXISTS mt5_trade_commands_connection_status_idx
  ON public.mt5_trade_commands (connection_id, status);

CREATE INDEX IF NOT EXISTS mt5_trade_commands_user_created_idx
  ON public.mt5_trade_commands (user_id, created_at DESC);

-- Audit table for trade command events
CREATE TABLE IF NOT EXISTS public.mt5_trade_command_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  command_id uuid NOT NULL REFERENCES public.mt5_trade_commands(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status_before text,
  status_after text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT ON public.mt5_trade_command_audit TO authenticated;
GRANT ALL ON public.mt5_trade_command_audit TO service_role;

-- RLS for audit table
ALTER TABLE public.mt5_trade_command_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own audit logs" ON public.mt5_trade_command_audit;
CREATE POLICY "Users read own audit logs" ON public.mt5_trade_command_audit
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Indexes for audit table
CREATE INDEX IF NOT EXISTS mt5_trade_command_audit_command_id_idx
  ON public.mt5_trade_command_audit (command_id);

CREATE INDEX IF NOT EXISTS mt5_trade_command_audit_user_id_idx
  ON public.mt5_trade_command_audit (user_id);

CREATE INDEX IF NOT EXISTS mt5_trade_command_audit_created_at_idx
  ON public.mt5_trade_command_audit (created_at DESC);

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS mt5_trade_commands_updated_at ON public.mt5_trade_commands;
CREATE TRIGGER mt5_trade_commands_updated_at
  BEFORE UPDATE ON public.mt5_trade_commands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();