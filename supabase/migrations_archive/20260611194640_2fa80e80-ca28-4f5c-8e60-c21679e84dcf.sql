
ALTER TABLE public.ladder_challenges
  ALTER COLUMN ladder_id DROP NOT NULL,
  ALTER COLUMN challenger_position DROP NOT NULL,
  ALTER COLUMN challenged_position DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS tournament_category_id uuid REFERENCES public.tournament_categories(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tournament_match_id uuid REFERENCES public.tournament_matches(id) ON DELETE SET NULL;

ALTER TABLE public.ladder_challenges
  DROP CONSTRAINT IF EXISTS chk_challenge_target;
ALTER TABLE public.ladder_challenges
  ADD CONSTRAINT chk_challenge_target
  CHECK ((ladder_id IS NOT NULL) <> (tournament_category_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_ladder_challenges_tournament_category
  ON public.ladder_challenges(tournament_category_id)
  WHERE tournament_category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ladder_challenges_tournament_match
  ON public.ladder_challenges(tournament_match_id)
  WHERE tournament_match_id IS NOT NULL;

-- Policy extra: participantes de la categoría también pueden ver el desafío
DROP POLICY IF EXISTS "Participantes de torneo ven sus desafíos" ON public.ladder_challenges;
CREATE POLICY "Participantes de torneo ven sus desafíos"
  ON public.ladder_challenges FOR SELECT TO authenticated
  USING (
    tournament_category_id IS NOT NULL AND (
      challenger_user_id = auth.uid()
      OR challenged_user_id = auth.uid()
      OR challenger_partner_user_id = auth.uid()
      OR challenged_partner_user_id = auth.uid()
    )
  );
