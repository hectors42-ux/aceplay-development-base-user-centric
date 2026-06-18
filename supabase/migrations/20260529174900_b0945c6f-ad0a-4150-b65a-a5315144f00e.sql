-- Fase A.5: columnas aditivas para Open Match multi-deporte/multi-modo
DO $$ BEGIN
  CREATE TYPE public.open_match_type AS ENUM ('singles','doubles');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.open_match_mode AS ENUM ('open_slots','pair_vs_pair');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.open_match_gender_filter AS ENUM ('any','male','female','mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.match_open_posts
  ADD COLUMN IF NOT EXISTS match_type    public.open_match_type            NOT NULL DEFAULT 'singles',
  ADD COLUMN IF NOT EXISTS mode          public.open_match_mode            NOT NULL DEFAULT 'open_slots',
  ADD COLUMN IF NOT EXISTS slots_total   smallint                          NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS sport         text                              NOT NULL DEFAULT 'tenis',
  ADD COLUMN IF NOT EXISTS gender_filter public.open_match_gender_filter   NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS level_min     numeric(3,1),
  ADD COLUMN IF NOT EXISTS level_max     numeric(3,1),
  ADD COLUMN IF NOT EXISTS court_id      uuid;

-- Backfill defensivo (defaults ya cubren, pero forzamos coherencia)
UPDATE public.match_open_posts
SET match_type  = COALESCE(match_type,'singles'),
    mode        = COALESCE(mode,'open_slots'),
    slots_total = COALESCE(slots_total, 2),
    sport       = COALESCE(sport,'tenis')
WHERE match_type IS NULL OR mode IS NULL OR slots_total IS NULL OR sport IS NULL;

-- Constraint: slots coherentes con tipo de partido
ALTER TABLE public.match_open_posts
  DROP CONSTRAINT IF EXISTS chk_match_open_posts_slots;
ALTER TABLE public.match_open_posts
  ADD CONSTRAINT chk_match_open_posts_slots CHECK (
    (match_type = 'singles' AND slots_total = 2) OR
    (match_type = 'doubles' AND slots_total = 4)
  );

CREATE INDEX IF NOT EXISTS idx_match_open_posts_sport_type
  ON public.match_open_posts(tenant_id, sport, match_type, status);