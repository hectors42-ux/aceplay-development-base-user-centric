
CREATE TABLE IF NOT EXISTS public.americano_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tournament_category_id uuid NOT NULL REFERENCES public.tournament_categories(id) ON DELETE CASCADE,
  round_number int NOT NULL CHECK (round_number >= 1),
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','en_juego','finalizada')),
  bye_user_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_category_id, round_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.americano_rounds TO authenticated;
GRANT ALL ON public.americano_rounds TO service_role;

ALTER TABLE public.americano_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Miembros del tenant ven rondas americano" ON public.americano_rounds;
CREATE POLICY "Miembros del tenant ven rondas americano"
ON public.americano_rounds FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.tenant_id = americano_rounds.tenant_id
  )
);

DROP POLICY IF EXISTS "Admins gestionan rondas americano" ON public.americano_rounds;
CREATE POLICY "Admins gestionan rondas americano"
ON public.americano_rounds FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tournament_categories tc
    JOIN public.tournaments t ON t.id = tc.tournament_id
    WHERE tc.id = americano_rounds.tournament_category_id
      AND public.is_tournament_manager(t.id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tournament_categories tc
    JOIN public.tournaments t ON t.id = tc.tournament_id
    WHERE tc.id = americano_rounds.tournament_category_id
      AND public.is_tournament_manager(t.id)
  )
);

DROP TRIGGER IF EXISTS update_americano_rounds_updated_at ON public.americano_rounds;
CREATE TRIGGER update_americano_rounds_updated_at
  BEFORE UPDATE ON public.americano_rounds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS americano_round_id uuid REFERENCES public.americano_rounds(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS side_a_user_ids uuid[],
  ADD COLUMN IF NOT EXISTS side_b_user_ids uuid[],
  ADD COLUMN IF NOT EXISTS winner_side char(1);

ALTER TABLE public.tournament_matches
  DROP CONSTRAINT IF EXISTS tournament_matches_phase_check;
ALTER TABLE public.tournament_matches
  ADD CONSTRAINT tournament_matches_phase_check
  CHECK (phase IS NULL OR phase IN ('grupos','playoff','americano'));

ALTER TABLE public.tournament_matches
  DROP CONSTRAINT IF EXISTS tournament_matches_winner_side_check;
ALTER TABLE public.tournament_matches
  ADD CONSTRAINT tournament_matches_winner_side_check
  CHECK (winner_side IS NULL OR winner_side IN ('a','b'));

CREATE INDEX IF NOT EXISTS idx_tournament_matches_americano_round
  ON public.tournament_matches(americano_round_id)
  WHERE americano_round_id IS NOT NULL;

ALTER TABLE public.tournament_categories
  ADD COLUMN IF NOT EXISTS americano_rounds_target int CHECK (americano_rounds_target IS NULL OR americano_rounds_target >= 1);
