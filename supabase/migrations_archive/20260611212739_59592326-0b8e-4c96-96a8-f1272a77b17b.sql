-- Fix: el único índice de posición no consideraba bracket, lo que rompía
-- consolación (main+plate) y doble eliminación (winners+losers+grand_final).
ALTER TABLE public.tournament_matches
  DROP CONSTRAINT IF EXISTS matches_unique_position;

CREATE UNIQUE INDEX IF NOT EXISTS matches_unique_position
  ON public.tournament_matches (tournament_id, bracket, round, bracket_position);

-- Re-seed de consolación y doble eliminación QA
DO $$
DECLARE
  v_tenant uuid := public._qa_tenant_id();
  v_tour record;
BEGIN
  IF v_tenant IS NULL THEN RETURN; END IF;
  FOR v_tour IN
    SELECT t.id FROM public.tournaments t
    JOIN public.tournament_categories tc ON tc.tournament_id = t.id
    WHERE t.tenant_id = v_tenant
      AND tc.motor IN ('consolacion','doble_eliminacion')
  LOOP
    DELETE FROM public.tournament_matches WHERE tournament_id = v_tour.id;
    DELETE FROM public.tournament_registrations WHERE tournament_id = v_tour.id;
    DELETE FROM public.tournament_categories WHERE tournament_id = v_tour.id;
    DELETE FROM public.tournaments WHERE id = v_tour.id;
  END LOOP;

  PERFORM public.qa_seed_tournament('consolacion','admin','finalizado', 16);
  PERFORM public.qa_seed_tournament('doble_eliminacion','admin','finalizado', 16);
END $$;