\i supabase/tests/setup.sql

BEGIN;
SELECT plan(5);

-- Tenant y un torneo padre QA para insertar categorías de prueba.
DO $$
DECLARE v_tour uuid; v_tenant uuid := public._qa_tenant_id();
BEGIN
  SELECT id INTO v_tour FROM public.tournaments WHERE tenant_id=v_tenant LIMIT 1;
  PERFORM set_config('qa.tour_id', v_tour::text, true);
  PERFORM set_config('qa.tenant_id', v_tenant::text, true);
END $$;

-- 1. (padel, singles) es rechazado.
SELECT throws_like(
  $$ INSERT INTO public.tournament_categories
       (tournament_id, tenant_id, name, sport, modality, motor)
     VALUES (current_setting('qa.tour_id')::uuid,
             current_setting('qa.tenant_id')::uuid,
             'cimientos-padel-singles', 'padel'::tournament_sport,
             'singles'::tournament_modality, 'round_robin'::competition_motor) $$,
  '%chk_padel_es_dobles%',
  '(padel, singles) viola chk_padel_es_dobles'
);

-- 2. (padel, dobles) y (tenis, singles/dobles) son válidos.
SELECT lives_ok(
  $$ INSERT INTO public.tournament_categories
       (tournament_id, tenant_id, name, sport, modality, motor, discipline)
     VALUES (current_setting('qa.tour_id')::uuid, current_setting('qa.tenant_id')::uuid,
             'cimientos-padel-dobles', 'padel', 'dobles', 'round_robin', 'padel_dobles'),
            (current_setting('qa.tour_id')::uuid, current_setting('qa.tenant_id')::uuid,
             'cimientos-tenis-singles', 'tenis', 'singles', 'round_robin', 'tenis_singles'),
            (current_setting('qa.tour_id')::uuid, current_setting('qa.tenant_id')::uuid,
             'cimientos-tenis-dobles', 'tenis', 'dobles', 'round_robin', 'tenis_dobles') $$,
  'combinaciones válidas de sport/modality se aceptan'
);

-- 3. Todas las registrations seedeadas tienen tournament_category_id no nulo.
SELECT is(
  (SELECT COUNT(*)::int FROM public.tournament_registrations
    WHERE tenant_id = public._qa_tenant_id()
      AND tournament_category_id IS NULL),
  0,
  'toda registration QA tiene tournament_category_id'
);

-- 4. generate_bracket no contamina entre categorías: cada match pertenece a la suya.
SELECT is(
  (
    SELECT COUNT(*)::int FROM public.tournament_matches tm
    JOIN public.tournament_categories tc ON tc.id = tm.tournament_category_id
    WHERE tm.tenant_id <> tc.tenant_id
  ),
  0,
  'matches no cruzan tenants/categorías'
);

-- 5. No hay tournament_matches huérfanos (sin categoría existente).
SELECT is(
  (
    SELECT COUNT(*)::int FROM public.tournament_matches tm
    LEFT JOIN public.tournament_categories tc ON tc.id = tm.tournament_category_id
    WHERE tc.id IS NULL
  ),
  0,
  'ningún match huérfano sin categoría'
);

SELECT * FROM finish();
ROLLBACK;