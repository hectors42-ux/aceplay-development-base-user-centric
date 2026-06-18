
-- qa_reset corregido: borra auth.users primero para cascadear profiles
CREATE OR REPLACE FUNCTION public.qa_reset(_slug text DEFAULT 'qa-sandbox')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_tenant uuid;
  v_user_ids uuid[];
BEGIN
  IF _slug IS DISTINCT FROM 'qa-sandbox' THEN
    RAISE EXCEPTION 'qa_reset SOLO opera sobre el tenant qa-sandbox (recibió %)', _slug;
  END IF;

  SELECT id INTO v_tenant FROM public.tenants WHERE slug = 'qa-sandbox';
  IF v_tenant IS NOT NULL THEN
    SELECT array_agg(user_id) INTO v_user_ids FROM public.profiles WHERE tenant_id = v_tenant;
    IF v_user_ids IS NOT NULL THEN
      DELETE FROM auth.users WHERE id = ANY(v_user_ids);
    END IF;
    DELETE FROM public.tenants WHERE id = v_tenant;
  END IF;

  INSERT INTO public.tenants (slug, name, short_name, ladder_label)
  VALUES ('qa-sandbox', 'QA Sandbox', 'QA', 'Pirámide');
END;
$$;

-- Helper: arma una llave de eliminación simple inline (mismo algoritmo que generate_bracket)
CREATE OR REPLACE FUNCTION public._qa_build_bracket(_cat uuid, _seeds uuid[], _bracket text DEFAULT 'main')
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cat public.tournament_categories%ROWTYPE;
  v_regs uuid[] := _seeds;
  v_count int;
  v_bracket_size int := 2;
  v_total_rounds int;
  v_r int;
  v_p int;
  v_m int;
  v_a uuid;
  v_b uuid;
BEGIN
  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = _cat;
  v_count := COALESCE(array_length(v_regs,1),0);
  IF v_count < 2 THEN RAISE EXCEPTION 'Bracket requiere >=2 (got %)', v_count; END IF;

  WHILE v_bracket_size < v_count LOOP v_bracket_size := v_bracket_size * 2; END LOOP;
  v_total_rounds := CEIL(LOG(2, v_bracket_size))::int;
  WHILE COALESCE(array_length(v_regs,1),0) < v_bracket_size LOOP
    v_regs := array_append(v_regs, NULL::uuid);
  END LOOP;

  FOR v_r IN REVERSE 1..v_total_rounds LOOP
    v_m := v_bracket_size / (2 ^ (v_total_rounds - v_r + 1))::int;
    FOR v_p IN 1..v_m LOOP
      INSERT INTO public.tournament_matches (
        tournament_id, tournament_category_id, tenant_id, round, bracket_position, bracket
      ) VALUES (v_cat.tournament_id, _cat, v_cat.tenant_id, v_r, v_p, _bracket);
    END LOOP;
  END LOOP;

  -- next_match links
  UPDATE public.tournament_matches m
     SET next_match_id = nm.id,
         next_match_slot = CASE WHEN (m.bracket_position % 2)=1 THEN 'a' ELSE 'b' END
    FROM public.tournament_matches nm
   WHERE m.tournament_category_id=_cat AND m.bracket=_bracket
     AND nm.tournament_category_id=_cat AND nm.bracket=_bracket
     AND m.round > 1
     AND nm.round = m.round - 1
     AND nm.bracket_position = CEIL(m.bracket_position::numeric / 2);

  -- siembra ronda final (= round más alto)
  FOR v_p IN 1..(v_bracket_size/2) LOOP
    v_a := v_regs[(v_p-1)*2 + 1];
    v_b := v_regs[(v_p-1)*2 + 2];
    UPDATE public.tournament_matches
       SET registration_a_id = v_a,
           registration_b_id = v_b,
           status = (CASE WHEN v_a IS NULL OR v_b IS NULL THEN 'walkover' ELSE 'pendiente' END)::match_status,
           winner_registration_id = CASE
             WHEN v_a IS NOT NULL AND v_b IS NULL THEN v_a
             WHEN v_b IS NOT NULL AND v_a IS NULL THEN v_b
             ELSE NULL END,
           walkover = (v_a IS NULL OR v_b IS NULL)
     WHERE tournament_category_id=_cat AND bracket=_bracket
       AND round=v_total_rounds AND bracket_position=v_p;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public._qa_build_bracket(uuid, uuid[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._qa_build_bracket(uuid, uuid[], text) TO service_role;

-- Helper: round robin todos contra todos
CREATE OR REPLACE FUNCTION public._qa_build_round_robin(_cat uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cat public.tournament_categories%ROWTYPE;
  v_regs uuid[];
  v_n int;
  v_i int;
  v_j int;
  v_pos int := 0;
  v_count int := 0;
BEGIN
  SELECT * INTO v_cat FROM public.tournament_categories WHERE id=_cat;
  SELECT array_agg(id ORDER BY registered_at) INTO v_regs
    FROM public.tournament_registrations
   WHERE tournament_category_id=_cat AND status='confirmada';
  v_n := COALESCE(array_length(v_regs,1),0);
  IF v_n < 3 THEN RAISE EXCEPTION 'Round robin requiere >=3 (got %)', v_n; END IF;
  FOR v_i IN 1..(v_n-1) LOOP
    FOR v_j IN (v_i+1)..v_n LOOP
      v_pos := v_pos + 1;
      INSERT INTO public.tournament_matches (
        tournament_id, tournament_category_id, tenant_id, round, bracket_position,
        registration_a_id, registration_b_id, status
      ) VALUES (
        v_cat.tournament_id, _cat, v_cat.tenant_id, 1, v_pos,
        v_regs[v_i], v_regs[v_j], 'pendiente'::match_status
      );
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public._qa_build_round_robin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._qa_build_round_robin(uuid) TO service_role;

-- qa_seed_tournament reescrito con generación inline + tolerancia a errores
CREATE OR REPLACE FUNCTION public.qa_seed_tournament(
  _motor text,
  _scheduling text DEFAULT 'admin',
  _state text DEFAULT 'en_curso',
  _participants int DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_tenant uuid := public._qa_tenant_id();
  v_admin uuid := public._qa_admin_uid();
  v_name text;
  v_tour_id uuid;
  v_cat_id uuid;
  v_n int;
  v_sport tournament_sport := 'tenis';
  v_modality tournament_modality := 'singles';
  v_discipline tournament_discipline := 'tenis_singles';
  v_motor competition_motor;
  v_seeds uuid[];
  v_player_ids uuid[];
  v_i int;
  v_pct numeric;
  v_match record;
  v_pos int := 0;
BEGIN
  IF v_tenant IS NULL OR v_admin IS NULL THEN
    RAISE EXCEPTION 'Falta tenant/admin QA. Corre qa_seed_players() primero.';
  END IF;

  v_motor := _motor::competition_motor;

  IF _motor = 'americano_rotacion' THEN
    v_sport := 'padel'; v_modality := 'dobles'; v_discipline := 'padel_dobles';
    v_n := COALESCE(_participants, 8);
  ELSIF _motor IN ('doble_eliminacion','consolacion','grupos_playoff') THEN
    v_n := COALESCE(_participants, 16);
  ELSIF _motor = 'round_robin' THEN
    v_n := COALESCE(_participants, 12);
  ELSE
    v_n := COALESCE(_participants, 8);
  END IF;

  v_name := format('[QA] %s · %s · %s · n=%s', _motor, _scheduling, _state, v_n);

  SELECT id INTO v_tour_id FROM public.tournaments WHERE tenant_id=v_tenant AND name=v_name;
  IF v_tour_id IS NOT NULL THEN RETURN v_tour_id; END IF;

  INSERT INTO public.tournaments (
    tenant_id, name, slug, description,
    registration_opens_at, registration_closes_at, starts_at, ends_at,
    status, created_by, default_config
  ) VALUES (
    v_tenant, v_name,
    'qa-' || lower(regexp_replace(_motor || '-' || _scheduling || '-' || _state || '-' || v_n::text, '[^a-z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6),
    'Torneo QA sintético — motor ' || _motor,
    now() - interval '14 days', now() - interval '1 day',
    now() + interval '1 day', now() + interval '30 days',
    'inscripciones_abiertas'::tournament_status, v_admin, '{}'::jsonb
  ) RETURNING id INTO v_tour_id;

  INSERT INTO public.tournament_categories (
    tournament_id, tenant_id, name, category_label,
    gender, discipline, surface, max_participants, status,
    sport, modality, motor, scheduling,
    americano_rounds_target
  ) VALUES (
    v_tour_id, v_tenant, 'Open ' || _motor, 'Open',
    'mixto', v_discipline, 'arcilla', v_n,
    'inscripciones_abiertas'::tournament_status,
    v_sport, v_modality, v_motor, _scheduling,
    CASE WHEN _motor = 'americano_rotacion' THEN 4 ELSE NULL END
  ) RETURNING id INTO v_cat_id;

  -- Selecciona jugadores e inscribe
  SELECT array_agg(user_id) INTO v_player_ids
    FROM (
      SELECT p.user_id
        FROM public.profiles p
       WHERE p.tenant_id = v_tenant
         AND p.email LIKE 'qa%@aceplay.test'
         AND p.email <> 'qa-admin@aceplay.test'
       ORDER BY p.email
       LIMIT v_n
    ) s;
  IF v_player_ids IS NULL OR array_length(v_player_ids,1) < v_n THEN
    RAISE EXCEPTION 'Faltan jugadores QA (necesito %, hay %)', v_n, COALESCE(array_length(v_player_ids,1),0);
  END IF;

  IF v_modality = 'dobles' AND _motor <> 'americano_rotacion' THEN
    FOR v_i IN 1..(v_n/2) LOOP
      INSERT INTO public.tournament_registrations (
        tournament_id, tournament_category_id, tenant_id,
        player1_user_id, player2_user_id, status, confirmed_at
      ) VALUES (
        v_tour_id, v_cat_id, v_tenant,
        v_player_ids[(v_i-1)*2 + 1], v_player_ids[(v_i-1)*2 + 2],
        'confirmada'::registration_status, now()
      );
    END LOOP;
  ELSE
    FOR v_i IN 1..v_n LOOP
      INSERT INTO public.tournament_registrations (
        tournament_id, tournament_category_id, tenant_id,
        player1_user_id, status, confirmed_at
      ) VALUES (
        v_tour_id, v_cat_id, v_tenant,
        v_player_ids[v_i],
        'confirmada'::registration_status, now()
      );
    END LOOP;
  END IF;

  IF _state = 'abierto' THEN RETURN v_tour_id; END IF;

  -- Genera fixture inline (sin depender de generate_bracket)
  SELECT array_agg(id ORDER BY registered_at) INTO v_seeds
    FROM public.tournament_registrations WHERE tournament_category_id=v_cat_id;

  BEGIN
    IF _motor = 'eliminacion_simple' THEN
      PERFORM public._qa_build_bracket(v_cat_id, v_seeds, 'main');
    ELSIF _motor = 'consolacion' THEN
      PERFORM public._qa_build_bracket(v_cat_id, v_seeds, 'main');
      -- plate: mitad del tamaño del main, sin participantes (sólo estructura)
      PERFORM public._qa_build_bracket(v_cat_id, v_seeds[1:(array_length(v_seeds,1)/2)], 'plate');
    ELSIF _motor = 'doble_eliminacion' THEN
      PERFORM public._qa_build_bracket(v_cat_id, v_seeds, 'winners');
      PERFORM public._qa_build_bracket(v_cat_id, v_seeds[1:(array_length(v_seeds,1)/2)], 'losers');
      -- gran final (1 partido)
      INSERT INTO public.tournament_matches (tournament_id, tournament_category_id, tenant_id, round, bracket_position, bracket)
      VALUES ((SELECT tournament_id FROM tournament_categories WHERE id=v_cat_id), v_cat_id, v_tenant, 1, 1, 'grand_final');
    ELSIF _motor = 'round_robin' THEN
      PERFORM public._qa_build_round_robin(v_cat_id);
    ELSIF _motor = 'grupos_playoff' THEN
      -- modela como round_robin simple (un grupo grande) por simplicidad QA
      PERFORM public._qa_build_round_robin(v_cat_id);
    ELSIF _motor = 'americano_rotacion' THEN
      -- 2 rondas, parejas rotadas trivialmente: (1,2)vs(3,4), (5,6)vs(7,8)
      DECLARE v_round_id uuid; v_round int; v_t int; v_pids uuid[];
      BEGIN
        SELECT array_agg(player1_user_id ORDER BY registered_at) INTO v_pids
          FROM public.tournament_registrations WHERE tournament_category_id=v_cat_id;
        FOR v_round IN 1..2 LOOP
          INSERT INTO public.americano_rounds (tenant_id, tournament_category_id, round_number, status)
          VALUES (v_tenant, v_cat_id, v_round, 'finalizada') RETURNING id INTO v_round_id;
          FOR v_t IN 0..((array_length(v_pids,1)/4)-1) LOOP
            INSERT INTO public.tournament_matches (
              tournament_id, tournament_category_id, tenant_id, round, bracket_position,
              americano_round_id, side_a_user_ids, side_b_user_ids,
              phase, status, winner_side, score, played_at
            ) VALUES (
              (SELECT tournament_id FROM tournament_categories WHERE id=v_cat_id), v_cat_id, v_tenant,
              v_round, v_t+1, v_round_id,
              ARRAY[v_pids[v_t*4+1+((v_round-1)%2)*0], v_pids[v_t*4+2]],
              ARRAY[v_pids[v_t*4+3], v_pids[v_t*4+4]],
              'americano', 'jugado'::match_status,
              CASE WHEN random()<0.5 THEN 'a' ELSE 'b' END,
              public._qa_random_score(_motor), now()
            );
          END LOOP;
        END LOOP;
      END;
    END IF;

    UPDATE public.tournament_categories
       SET bracket_generated_at = now(),
           roster_locked_at = now(),
           status = 'en_curso'
     WHERE id = v_cat_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[QA] Falló generación del motor % (%): %', _motor, _scheduling, SQLERRM;
    RETURN v_tour_id;
  END;

  UPDATE public.tournaments SET status='en_curso'::tournament_status WHERE id=v_tour_id;

  -- Resultados sintéticos (no aplica para americano que ya está jugado)
  IF _motor = 'americano_rotacion' THEN RETURN v_tour_id; END IF;

  v_pct := CASE _state WHEN 'finalizado' THEN 1.0 ELSE 0.5 END;

  FOR v_match IN
    SELECT id FROM public.tournament_matches
     WHERE tournament_category_id = v_cat_id AND americano_round_id IS NULL
     ORDER BY round, bracket_position
  LOOP
    DECLARE
      v_a uuid; v_b uuid; v_winner uuid; v_status match_status;
    BEGIN
      SELECT registration_a_id, registration_b_id, status INTO v_a, v_b, v_status
        FROM public.tournament_matches WHERE id = v_match.id;
      IF v_status <> 'pendiente' OR v_a IS NULL OR v_b IS NULL THEN CONTINUE; END IF;
      IF random() > v_pct THEN CONTINUE; END IF;
      v_winner := CASE WHEN random() < 0.5 THEN v_a ELSE v_b END;
      UPDATE public.tournament_matches
         SET winner_registration_id = v_winner,
             score = public._qa_random_score(_motor),
             status = 'jugado'::match_status,
             played_at = now()
       WHERE id = v_match.id;
    END;
  END LOOP;

  RETURN v_tour_id;
END;
$$;
