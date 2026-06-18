
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS default_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.tournament_categories
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preset_key text;
