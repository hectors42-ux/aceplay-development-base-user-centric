ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS sports text[] NOT NULL DEFAULT ARRAY['tenis']::text[];

CREATE INDEX IF NOT EXISTS idx_coach_profiles_sports ON public.coach_profiles USING GIN (sports);

COMMENT ON COLUMN public.coach_profiles.sports IS 'Deportes que enseña el coach: tenis, padel o ambos';