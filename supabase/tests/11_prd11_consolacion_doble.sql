\i supabase/tests/setup.sql

BEGIN;
SELECT plan(4);

-- 1. Consolación: existe al menos una categoría con cuadros main + plate.
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.tournament_categories tc
    WHERE tc.tenant_id = public._qa_tenant_id()
      AND tc.motor = 'consolacion'
      AND EXISTS (SELECT 1 FROM public.tournament_matches WHERE tournament_category_id=tc.id AND bracket='main')
      AND EXISTS (SELECT 1 FROM public.tournament_matches WHERE tournament_category_id=tc.id AND bracket='plate')
  ),
  'consolacion seedeada tiene matches main + plate'
);

-- 2. La cantidad de matches del plate respeta el tamaño esperado (plate = main_size/2).
SELECT is(
  (
    SELECT MAX(plate_total) FROM (
      SELECT tc.id,
        (SELECT COUNT(*) FROM public.tournament_matches
          WHERE tournament_category_id=tc.id AND bracket='plate') AS plate_total,
        (SELECT COUNT(*) FROM public.tournament_matches
          WHERE tournament_category_id=tc.id AND bracket='main') AS main_total
      FROM public.tournament_categories tc
      WHERE tc.tenant_id = public._qa_tenant_id()
        AND tc.motor = 'consolacion'
    ) s
  )::int,
  -- Para n=16: main=15, plate=7
  7,
  'consolacion seedeada produce el número correcto de matches en plate'
);

-- 3. Doble eliminación: hay matches de winners, losers y grand_final.
SELECT is(
  (
    SELECT COUNT(DISTINCT bracket)::int FROM public.tournament_matches tm
    JOIN public.tournament_categories tc ON tc.id = tm.tournament_category_id
    WHERE tc.tenant_id = public._qa_tenant_id()
      AND tc.motor = 'doble_eliminacion'
      AND bracket IN ('winners','losers','grand_final')
  ),
  3,
  'doble eliminación contiene winners + losers + grand_final'
);

-- 4. Generar consolación con 4 inscritos NO genera plate (plate_size < 2).
DO $$
DECLARE
  v_tenant uuid := public._qa_tenant_id(); v_admin uuid := public._qa_admin_uid();
  v_tour uuid; v_cat uuid; v_uids uuid[]; i int;
BEGIN
  PERFORM public._qa_impersonate(v_admin);

  INSERT INTO public.tournaments (tenant_id, name, slug, registration_opens_at,
    registration_closes_at, starts_at, ends_at, status, created_by, default_config)
  VALUES (v_tenant, '[QA-C4] consol-mini', 'qa-c4-' || substr(md5(random()::text),1,6),
          now()-interval'1 day', now()+interval'1 day', now()+interval'2 days',
          now()+interval'30 days', 'inscripciones_abiertas', v_admin, '{}'::jsonb)
  RETURNING id INTO v_tour;

INSERT INTO public.tournament_categories (tournament_id, tenant_id, name, sport, modality, motor, discipline, max_participants)
  VALUES (v_tour, v_tenant, 'Open C2', 'tenis', 'singles', 'consolacion', 'tenis_singles', 2)
  RETURNING id INTO v_cat;

  SELECT array_agg(user_id) INTO v_uids FROM (
    SELECT user_id FROM public.profiles
     WHERE tenant_id=v_tenant AND email LIKE 'qa%@aceplay.test'
       AND email <> 'qa-admin@aceplay.test'
     ORDER BY email LIMIT 2) s;

  FOR i IN 1..2 LOOP
    INSERT INTO public.tournament_registrations
      (tournament_id, tournament_category_id, tenant_id, player1_user_id, status, confirmed_at)
    VALUES (v_tour, v_cat, v_tenant, v_uids[i], 'confirmada'::registration_status, now());
  END LOOP;

  PERFORM public.generate_consolation(v_cat, NULL);
  PERFORM set_config('qa.cat_c2', v_cat::text, true);
END $$;

SELECT is(
  (SELECT COUNT(*)::int FROM public.tournament_matches
    WHERE tournament_category_id = current_setting('qa.cat_c2')::uuid
      AND bracket = 'plate'),
  0,
  'consolacion con 2 inscritos NO genera bracket plate (regla plate_size<2)'
);

SELECT * FROM finish();
ROLLBACK;