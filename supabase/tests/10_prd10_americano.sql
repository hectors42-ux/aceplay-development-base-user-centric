\i supabase/tests/setup.sql

BEGIN;
SELECT plan(3);

-- El mundo QA siembra una categoría americano. Aprovechamos esa data.
DO $$
DECLARE v_cat uuid;
BEGIN
  SELECT tc.id INTO v_cat
    FROM public.tournament_categories tc
   WHERE tc.tenant_id = public._qa_tenant_id()
     AND tc.motor = 'americano_rotacion'
   LIMIT 1;
  PERFORM set_config('qa.cat_am', v_cat::text, true);
END $$;

-- 1. Inscripción americano: no requiere pareja (player2 NULL).
SELECT is(
  (SELECT COUNT(*)::int FROM public.tournament_registrations
    WHERE tournament_category_id = current_setting('qa.cat_am')::uuid
      AND player2_user_id IS NULL),
  (SELECT COUNT(*)::int FROM public.tournament_registrations
    WHERE tournament_category_id = current_setting('qa.cat_am')::uuid),
  'americano: todas las inscripciones son individuales (sin pareja)'
);

-- 2. Cada match americano emite observación padel-dobles.
SELECT is(
  (
    SELECT COUNT(*)::int FROM public.match_observation_outbox o
    JOIN public.tournament_matches tm ON tm.id = o.tournament_match_id
    WHERE tm.tournament_category_id = current_setting('qa.cat_am')::uuid
      AND o.status = 'emitted'
      AND (o.sport <> 'padel' OR o.format <> 'dobles')
  ),
  0,
  'observaciones americano: sport=padel, format=dobles'
);

-- 3. americano_individual_standings suma juegos por user_id.
--    Validamos que sumen exactamente lo que están en los matches.
SELECT is(
  (SELECT COALESCE(SUM(games_won),0)::int FROM public.americano_individual_standings
    WHERE tournament_category_id = current_setting('qa.cat_am')::uuid),
  (
    -- Cada match aporta (games_a * 2) + (games_b * 2) al total (2 jugadores por lado).
    SELECT COALESCE(SUM(
      ( SELECT SUM(COALESCE((e->>'a')::int,0)+COALESCE((e->>'b')::int,0))
          FROM jsonb_array_elements(COALESCE(tm.score->'sets', tm.score)) e
         WHERE jsonb_typeof(COALESCE(tm.score->'sets', tm.score))='array'
      ) * 2
    ),0)::int
    FROM public.tournament_matches tm
    WHERE tm.tournament_category_id = current_setting('qa.cat_am')::uuid
      AND tm.status = 'jugado'::match_status
      AND tm.phase = 'americano'
  ),
  'americano standings: suma de juegos por usuario coincide con los partidos'
);

SELECT * FROM finish();
ROLLBACK;