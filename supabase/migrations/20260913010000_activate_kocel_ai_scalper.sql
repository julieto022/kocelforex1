-- Activate the existing Kocel AI Scalper system strategy.
-- Preserve its stable slug and existing id when the row is already present.

UPDATE public.strategies
SET is_active = true,
    status = 'available',
    is_builtin = true,
    updated_at = now()
WHERE slug = 'kocel-ai-scalper';

INSERT INTO public.strategies
  (name, slug, category, description, short_description, is_active, is_builtin,
   configuration, timeframe, timeframes, markets, status, configuration_schema)
VALUES
  ('Kocel AI Scalper', 'kocel-ai-scalper', 'Scalping',
   'Short-timeframe scalping logic driven by Kocel intelligence. Execution remains outside this phase.',
   'Kocel AI strategy definition for short-timeframe scalping.', true, true,
   '{}'::jsonb, 'M5', '["M1","M5","M15"]'::jsonb, '["forex","metals","indices"]'::jsonb,
   'available',
   '{"fields":[{"key":"max_spread","type":"number"},{"key":"risk_percent","type":"number"}]}'::jsonb)
ON CONFLICT (slug) DO UPDATE
SET is_active = true,
    is_builtin = true,
    status = 'available',
    updated_at = now();
