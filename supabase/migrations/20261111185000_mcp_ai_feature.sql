CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  token_hash text NOT NULL UNIQUE,
  token_hint text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_api_keys_user_created_idx
  ON public.mcp_api_keys (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mcp_api_keys_connection_idx
  ON public.mcp_api_keys (connection_id);

ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mcp_api_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.mcp_api_keys TO service_role;

CREATE TABLE IF NOT EXISTS public.mcp_trade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  api_key_id uuid NOT NULL REFERENCES public.mcp_api_keys(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING_APPROVAL'
    CHECK (status IN ('PENDING_APPROVAL', 'APPROVING', 'APPROVED', 'REJECTED', 'FAILED')),
  command_id uuid,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE INDEX IF NOT EXISTS mcp_trade_requests_user_created_idx
  ON public.mcp_trade_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mcp_trade_requests_pending_idx
  ON public.mcp_trade_requests (user_id, status, created_at DESC);

ALTER TABLE public.mcp_trade_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mcp_trade_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.mcp_trade_requests TO service_role;
