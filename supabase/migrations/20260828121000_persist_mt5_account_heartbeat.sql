-- Account figures are reported by the authenticated EA heartbeat. They are
-- stored on the already user-scoped connection so the dashboard reads real
-- terminal data without introducing a second authorization surface.
ALTER TABLE public.broker_connections
  ADD COLUMN IF NOT EXISTS balance numeric,
  ADD COLUMN IF NOT EXISTS equity numeric,
  ADD COLUMN IF NOT EXISTS margin numeric,
  ADD COLUMN IF NOT EXISTS free_margin numeric,
  ADD COLUMN IF NOT EXISTS margin_level numeric;