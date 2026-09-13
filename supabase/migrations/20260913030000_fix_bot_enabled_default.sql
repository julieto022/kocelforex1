-- Ensure bot creation can omit enabled while retaining the established default.
-- Newly created bots remain STOPPED; enabled controls future execution readiness.

UPDATE public.bots
SET enabled = true
WHERE enabled IS NULL;

ALTER TABLE public.bots
  ALTER COLUMN enabled SET DEFAULT true,
  ALTER COLUMN enabled SET NOT NULL;