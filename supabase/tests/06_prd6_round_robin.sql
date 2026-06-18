\i supabase/tests/setup.sql

BEGIN;
SELECT plan(4);

-- 1. Generar un RR de 6 inscritos => 15 matches (C(6,2)).
DO $$
DECLARE
  v_tenant uuid := public._qa_tenant_id();
  v_tour uuid; v_cat uuid; v_admin uuid := public._qa_admin_uid();
  v_uids uuid[];
  i int;
BEGIN
  PERFORM public._qa_impersonate(v_admin);

  INSERT INTO public.tournaments (tenant_id, name, slug, registration_opens_at,
    registration_closes_at, starts_at, ends_at, status, created_by, default_config)
  VALUES (v_tenant, '[QA-RR6] mini', 'qa-rr6-' || substr(md5(random()::text),1,6),
          now()-interval'1 day', now()+interval'1 day', now()+interval'2 days',
          now()+interval'30 days', 'inscripciones_abiertas', v_admin, '{}'::jsonb)
  RETURNING id INTO v_tour;

  INSERT INTO public.tournament_categories (tournament_id, tenant_id, name, sport, modality, motor, discipline)
  VALUES (v_tour, v_tenant, 'Open RR6', 'tenis', 'singles', 'round_robin', 'tenis_singles')
  RETURNING id INTO v_cat;

  SELECT array_agg(user_id) INTO v_uids FROM (
    SELECT user_id FROM public.profiles
     WHERE tenant_id=v_tenant AND email LIKE 'qa%@aceplay.test'
       AND email <> 'qa-admin@aceplay.test'
     ORDER BY email LIMIT 6
  ) s;

  FOR i IN 1..6 LOOP
    INSERT INTO public.tournament_registrations
      (tournament_id, tournament_category_id, tenant_id, player1_user_id, status, confirmed_at)
    VALUES (v_tour, v_cat, v_tenant, v_uids[i], 'confirmada'::registration_status, now());
  END LOOP;

  PERFORM public.generate_round_robin(v_cat);
  PERFORM set_config('qa.cat_rr', v_cat::text, true);
END $$;

SELECT is(
  (SELECT COUNT(*)::int FROM public.tournament_matches
    WHERE tournament_category_id = current_setting('qa.cat_rr')::uuid),
  15,
  'RR con 6 inscritos genera C(6,2)=15 matches'
);

-- 2. La vista round_robin_standings se puebla y suma juegos correctamente.
--    Sembramos resultados conocidos: registro X gana 2 partidos 6-0,6-0 y pierde 1 0-6,0-6.
DO $$
DECLARE v_cat uuid := current_setting('qa.cat_rr')::uuid;
  v_match record; v_target_reg uuid; i int := 0;
BEGIN
  -- Tomamos la inscripción 1 como "X" y simulamos 3 partidos
  SELECT id INTO v_target_reg
    FROM public.tournament_registrations
   WHERE tournament_category_id = v_cat ORDER BY registered_at LIMIT 1;

  FOR v_match IN
    SELECT id, registration_a_id, registration_b_id FROM public.tournament_matches
     WHERE tournament_category_id = v_cat
       AND (registration_a_id = v_target_reg OR registration_b_id = v_target_reg)
     ORDER BY id
  LOOP
    i := i + 1;
    UPDATE public.tournament_matches
       SET status='jugado'::match_status,
           winner_registration_id = CASE WHEN i <= 2 THEN v_target_reg
                                         ELSE CASE WHEN v_match.registration_a_id = v_target_reg
                                                   THEN v_match.registration_b_id
                                                   ELSE v_match.registration_a_id END END,
           score = CASE WHEN i <= 2 THEN '[{"a":6,"b":0},{"a":6,"b":0}]'::jsonb
                        ELSE '[{"a":0,"b":6},{"a":0,"b":6}]'::jsonb END,
           played_at = now()
     WHERE id = v_match.id;
  END LOOP;

  PERFORM set_config('qa.target_reg', v_target_reg::text, true);
END $$;

SELECT is(
  (SELECT games_won FROM public.round_robin_standings
    WHERE registration_id = current_setting('qa.target_reg')::uuid
    LIMIT 1),
  24,
  'standings: el jugador X tiene 2*(6+6) = 24 juegos ganados'
);

SELECT is(
  (SELECT matches_won FROM public.round_robin_standings
    WHERE registration_id = current_setting('qa.target_reg')::uuid
    LIMIT 1),
  2,
  'standings: el jugador X tiene 2 partidos ganados'
);

-- 3. chk_challenge_target rechaza ladder_id + tournament_category_id simultáneos.
SELECT throws_like(
  $$ INSERT INTO public.ladder_challenges
      (tenant_id, ladder_id, tournament_category_id, challenger_user_id,
       challenged_user_id, expires_at)
     VALUES (public._qa_tenant_id(), gen_random_uuid(), gen_random_uuid(),
             public._qa_admin_uid(), gen_random_uuid(), now()+interval'7 days') $$,
  '%chk_challenge_target%',
  'chk_challenge_target: no se aceptan ladder_id y tournament_category_id juntos'
);

SELECT * FROM finish();
ROLLBACK;