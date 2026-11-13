ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS automation_interval_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS automation_lot_size numeric NOT NULL DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS automation_next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS automation_last_run_at timestamptz;

ALTER TABLE public.bots
  DROP CONSTRAINT IF EXISTS bots_automation_interval_minutes_check,
  ADD CONSTRAINT bots_automation_interval_minutes_check
    CHECK (automation_interval_minutes BETWEEN 5 AND 1440),
  DROP CONSTRAINT IF EXISTS bots_automation_lot_size_check,
  ADD CONSTRAINT bots_automation_lot_size_check
    CHECK (automation_lot_size > 0 AND automation_lot_size <= 1000);

CREATE INDEX IF NOT EXISTS bots_automation_due_idx
  ON public.bots (automation_next_run_at)
  WHERE status = 'RUNNING' AND automation_next_run_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.bot_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING', 'SKIPPED', 'QUEUED', 'REJECTED', 'FAILED')),
  direction text CHECK (direction IN ('BUY', 'SELL')),
  reason text,
  signal jsonb,
  command_id uuid REFERENCES public.mt5_trade_commands(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (bot_id, scheduled_for)
);

CREATE INDEX IF NOT EXISTS bot_automation_runs_user_created_idx
  ON public.bot_automation_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bot_automation_runs_bot_created_idx
  ON public.bot_automation_runs (bot_id, created_at DESC);

ALTER TABLE public.bot_automation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_automation_runs FROM PUBLIC, anon;
GRANT SELECT ON public.bot_automation_runs TO authenticated;
GRANT ALL ON public.bot_automation_runs TO service_role;

DROP POLICY IF EXISTS bot_automation_runs_owner_select ON public.bot_automation_runs;
CREATE POLICY bot_automation_runs_owner_select
  ON public.bot_automation_runs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.claim_due_bot_automation_runs(p_limit integer DEFAULT 20)
RETURNS SETOF public.bot_automation_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT
      b.id AS bot_id,
      b.user_id,
      b.broker_connection_id AS connection_id,
      b.automation_next_run_at AS scheduled_for
    FROM public.bots AS b
    WHERE b.status = 'RUNNING'
      AND b.enabled
      AND b.broker_connection_id IS NOT NULL
      AND b.automation_next_run_at <= now()
      AND NOT EXISTS (
        SELECT 1
        FROM public.bot_automation_runs AS active_run
        WHERE active_run.bot_id = b.id
          AND active_run.status = 'RUNNING'
          AND active_run.created_at > now() - interval '15 minutes'
      )
    ORDER BY b.automation_next_run_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  ),
  advanced AS (
    UPDATE public.bots AS b
    SET
      automation_next_run_at = now() + make_interval(mins => b.automation_interval_minutes),
      automation_last_run_at = now()
    FROM due
    WHERE b.id = due.bot_id
    RETURNING b.id
  )
  INSERT INTO public.bot_automation_runs (
    bot_id,
    user_id,
    connection_id,
    scheduled_for,
    status
  )
  SELECT due.bot_id, due.user_id, due.connection_id, due.scheduled_for, 'RUNNING'
  FROM due
  INNER JOIN advanced ON advanced.id = due.bot_id
  ON CONFLICT (bot_id, scheduled_for) DO NOTHING
  RETURNING public.bot_automation_runs.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_bot_automation_runs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_bot_automation_runs(integer) TO service_role;
