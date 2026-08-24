-- NEWS
CREATE TABLE public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text,
  content text,
  source text,
  url text,
  image_url text,
  category text NOT NULL DEFAULT 'forex',
  impact text NOT NULL DEFAULT 'low',
  currency text,
  symbol text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news TO anon, authenticated;
GRANT ALL ON public.news TO service_role;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news readable" ON public.news FOR SELECT TO anon, authenticated USING (true);

-- ECONOMIC EVENTS
CREATE TABLE public.economic_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  currency text NOT NULL,
  impact text NOT NULL DEFAULT 'low',
  previous text,
  forecast text,
  actual text,
  event_time timestamptz NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.economic_events TO anon, authenticated;
GRANT ALL ON public.economic_events TO service_role;
ALTER TABLE public.economic_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "economic events readable" ON public.economic_events FOR SELECT TO anon, authenticated USING (true);

-- NFP PREDICTIONS
CREATE TABLE public.nfp_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_date timestamptz NOT NULL,
  forecast text,
  previous text,
  actual text,
  prediction text,
  confidence numeric,
  confidence_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  usd_impact text,
  gold_impact text,
  eurusd_impact text,
  gbpusd_impact text,
  nas100_impact text,
  expected_impact text,
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  analysis text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nfp_predictions TO anon, authenticated;
GRANT ALL ON public.nfp_predictions TO service_role;
ALTER TABLE public.nfp_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nfp readable" ON public.nfp_predictions FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER nfp_predictions_updated_at BEFORE UPDATE ON public.nfp_predictions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SIGNALS (produced by the Kocel signal engine; users only read)
CREATE TABLE public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  direction text NOT NULL,
  timeframe text,
  confidence numeric,
  confidence_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  entry numeric,
  entry_zone text,
  stop_loss numeric,
  take_profit numeric,
  risk_reward text,
  market_condition text,
  analysis jsonb NOT NULL DEFAULT '[]'::jsonb,
  result text,
  status text NOT NULL DEFAULT 'active',
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signals_user_created_idx ON public.signals (user_id, created_at DESC);
GRANT SELECT ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signals readable" ON public.signals FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

-- COMMUNITY POSTS
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  image_url text,
  symbol text,
  idea jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_posts_created_idx ON public.community_posts (created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts readable" ON public.community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "own posts insert" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own posts update" ON public.community_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own posts delete" ON public.community_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER community_posts_updated_at BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- COMMENTS
CREATE TABLE public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_comments_post_idx ON public.community_comments (post_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_comments TO authenticated;
GRANT ALL ON public.community_comments TO service_role;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments readable" ON public.community_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "own comments insert" ON public.community_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own comments update" ON public.community_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own comments delete" ON public.community_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- REACTIONS
CREATE TABLE public.community_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, reaction)
);
GRANT SELECT, INSERT, DELETE ON public.community_reactions TO authenticated;
GRANT ALL ON public.community_reactions TO service_role;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions readable" ON public.community_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "own reactions insert" ON public.community_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own reactions delete" ON public.community_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- FOLLOWS
CREATE TABLE public.community_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_follows TO authenticated;
GRANT ALL ON public.community_follows TO service_role;
ALTER TABLE public.community_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows readable" ON public.community_follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "own follows insert" ON public.community_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "own follows delete" ON public.community_follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- REPORTS
CREATE TABLE public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.community_reports TO authenticated;
GRANT ALL ON public.community_reports TO service_role;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports readable" ON public.community_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "own reports insert" ON public.community_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- BLOCKS (Block User support)
CREATE TABLE public.community_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_blocks TO authenticated;
GRANT ALL ON public.community_blocks TO service_role;
ALTER TABLE public.community_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks all" ON public.community_blocks FOR ALL TO authenticated USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);