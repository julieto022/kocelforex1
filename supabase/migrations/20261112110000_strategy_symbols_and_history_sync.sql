CREATE TABLE IF NOT EXISTS public.market_data_sync_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  timeframe text NOT NULL CHECK (timeframe IN ('M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1')),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SYNCING', 'COMPLETED', 'FAILED')),
  lease_until timestamptz,
  candle_count integer NOT NULL DEFAULT 0 CHECK (candle_count >= 0),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS market_data_sync_requests_poll_idx
  ON public.market_data_sync_requests (connection_id, status, lease_until, created_at);
CREATE INDEX IF NOT EXISTS market_data_sync_requests_owner_idx
  ON public.market_data_sync_requests (user_id, connection_id, created_at DESC);

ALTER TABLE public.market_data_sync_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_data_sync_requests FROM PUBLIC, anon;
GRANT SELECT ON public.market_data_sync_requests TO authenticated;
GRANT ALL ON public.market_data_sync_requests TO service_role;
DROP POLICY IF EXISTS market_data_sync_requests_owner_select
  ON public.market_data_sync_requests;
CREATE POLICY market_data_sync_requests_owner_select
  ON public.market_data_sync_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS market_data_sync_requests_updated_at
  ON public.market_data_sync_requests;
CREATE TRIGGER market_data_sync_requests_updated_at
  BEFORE UPDATE ON public.market_data_sync_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_owner_insert ON storage.objects;
CREATE POLICY avatars_owner_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_owner_update ON storage.objects;
CREATE POLICY avatars_owner_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_owner_delete ON storage.objects;
CREATE POLICY avatars_owner_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
