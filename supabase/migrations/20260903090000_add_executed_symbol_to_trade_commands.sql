-- Broker-independent MT5 symbol resolution: retain the actual symbol used by the EA.
ALTER TABLE public.mt5_trade_commands
  ADD COLUMN IF NOT EXISTS executed_symbol text;
