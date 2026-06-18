
ALTER TABLE public.tournament_categories
  ADD COLUMN IF NOT EXISTS scheduling text NOT NULL DEFAULT 'admin'
    CHECK (scheduling IN ('admin','desafio_libre','fixture_auto')),
  ADD COLUMN IF NOT EXISTS roster_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS tiebreaker_weights jsonb NOT NULL DEFAULT
    '{"matches":1,"sets":0.1,"games":0.01,"stb":0.001}'::jsonb;
