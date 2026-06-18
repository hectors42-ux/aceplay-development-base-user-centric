-- 1. Extender enum tournament_discipline con padel_dobles
ALTER TYPE public.tournament_discipline ADD VALUE IF NOT EXISTS 'padel_dobles';

-- 2. courts.sport
ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS sport text NOT NULL DEFAULT 'tenis'
    CHECK (sport IN ('tenis', 'padel'));

CREATE INDEX IF NOT EXISTS idx_courts_tenant_sport ON public.courts(tenant_id, sport);

-- 3. profiles: preferencias y datos de pádel
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_sport text NOT NULL DEFAULT 'tenis'
    CHECK (preferred_sport IN ('tenis', 'padel')),
  ADD COLUMN IF NOT EXISTS padel_position text
    CHECK (padel_position IS NULL OR padel_position IN ('drive', 'reves', 'ambos')),
  ADD COLUMN IF NOT EXISTS padel_dominant_side text
    CHECK (padel_dominant_side IS NULL OR padel_dominant_side IN ('drive', 'reves'));

-- 4. ladder_challenges: parejas para pádel
ALTER TABLE public.ladder_challenges
  ADD COLUMN IF NOT EXISTS challenger_partner_user_id uuid,
  ADD COLUMN IF NOT EXISTS challenged_partner_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_ladder_challenges_challenger_partner
  ON public.ladder_challenges(challenger_partner_user_id)
  WHERE challenger_partner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ladder_challenges_challenged_partner
  ON public.ladder_challenges(challenged_partner_user_id)
  WHERE challenged_partner_user_id IS NOT NULL;