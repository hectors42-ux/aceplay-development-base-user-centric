\i supabase/tests/setup.sql

BEGIN;
SELECT plan(2);

-- Crear una categoría grupos_playoff con 20 parejas → 4 grupos × 5 = 4 × C(5,2)=40 matches.
DO $$
DECLARE
  v_tenant uuid := public._qa_tenant_id();
  v_admin uuid := public._qa_admin_uid();
  v_tour uuid; v_cat uuid; v_uids uuid[]; i int;
BEGIN
  PERFORM public._qa_impersonate(v_admin);

  INSERT INTO public.tournaments (tenant_id, name, slug, registration_opens_at,
    registration_closes_at, starts_at, ends_at, status, created_by, default_config)
  VALUES (v_tenant, '[QA-GP20] grupos', 'qa-gp20-' || substr(md5(random()::text),1,6),
          now()-interval'1 day', now()+interval'1 day', now()+interval'2 days',
          now()+interval'30 days', 'inscripciones_abiertas', v_admin, '{}'::jsonb)
  RETURNING id INTO v_tour;

  INSERT INTO public.tournament_categories (tournament_id, tenant_id, name, sport, modality, motor, discipline)
  VALUES (v_tour, v_tenant, 'Open GP20', 'padel', 'dobles', 'grupos_playoff', 'padel_dobles')
  RETURNING id INTO v_cat;

  SELECT array_agg(user_id) INTO v_uids FROM (
    SELECT user_id FROM public.profiles
     WHERE tenant_id=v_tenant AND email LIKE 'qa%@aceplay.test'
       AND email <> 'qa-admin@aceplay.test'
     ORDER BY email LIMIT 40
  ) s;

  FOR i IN 1..20 LOOP
    INSERT INTO public.tournament_registrations
      (tournament_id, tournament_category_id, tenant_id, player1_user_id, player2_user_id, status, confirmed_at)
    VALUES (v_tour, v_cat, v_tenant, v_uids[(i-1)*2+1], v_uids[(i-1)*2+2],
            'confirmada'::registration_status, now());
  END LOOP;

  PERFORM public.generate_groups(v_cat, 4, NULL);
  PERFORM set_config('qa.cat_gp', v_cat::text, true);
END $$;

-- 1. 4 grupos × C(5,2)=10 matches = 40 partidos de fase grupos.
SELECT is(
  (SELECT COUNT(*)::int FROM public.tournament_matches
    WHERE tournament_category_id = current_setting('qa.cat_gp')::uuid
      AND phase = 'grupos'),
  40,
  'generate_groups con 20 parejas en 4 grupos produce 40 matches'
);

-- 2. advance_groups_to_playoff con grupos incompletos lanza error.
SELECT throws_ok(
  format('SELECT public.advance_groups_to_playoff(%L::uuid)', current_setting('qa.cat_gp')),
  NULL,
  NULL,
  'advance_groups_to_playoff falla con grupos incompletos'
);

SELECT * FROM finish();
ROLLBACK;