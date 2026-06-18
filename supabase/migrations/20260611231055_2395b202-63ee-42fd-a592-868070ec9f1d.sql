CREATE OR REPLACE FUNCTION public.generate_americano_round(_category_id uuid, _round_number integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cat public.tournament_categories%ROWTYPE;
  v_round_id uuid;
  v_players uuid[];
  v_remaining uuid[];
  v_bye uuid[];
  v_player_count int;
  v_tournament_id uuid;
  v_table_num int := 0;
  v_a1 uuid; v_a2 uuid; v_b1 uuid; v_b2 uuid;
  v_partner_count jsonb;
  v_pair_key text;
  v_other uuid;
  v_best_partner uuid;
  v_best_score int;
  v_score int;
BEGIN
  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;
  IF v_cat.motor::text <> 'americano_rotacion' THEN
    RAISE EXCEPTION 'Esta categoría no usa el motor americano_rotacion';
  END IF;

  v_tournament_id := v_cat.tournament_id;
  IF NOT public.is_tournament_manager(v_tournament_id) THEN
    RAISE EXCEPTION 'Solo el organizador puede generar rondas';
  END IF;

  IF EXISTS (SELECT 1 FROM public.americano_rounds WHERE tournament_category_id = _category_id AND round_number = _round_number) THEN
    RAISE EXCEPTION 'La ronda % ya existe', _round_number;
  END IF;

  IF _round_number > 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.americano_rounds
      WHERE tournament_category_id = _category_id
        AND round_number = _round_number - 1
        AND status = 'finalizada'
    ) THEN
      RAISE EXCEPTION 'La ronda anterior (%) no está finalizada', _round_number - 1;
    END IF;
  END IF;

  SELECT array_agg(player1_user_id ORDER BY random())
    INTO v_players
    FROM public.tournament_registrations
   WHERE tournament_category_id = _category_id
     AND status = 'confirmada'::registration_status;

  IF v_players IS NULL OR array_length(v_players,1) < 4 THEN
    RAISE EXCEPTION 'Se necesitan al menos 4 jugadores confirmados';
  END IF;

  v_player_count := array_length(v_players,1);

  v_partner_count := '{}'::jsonb;
  IF _round_number > 1 THEN
    SELECT COALESCE(jsonb_object_agg(k, c), '{}'::jsonb) INTO v_partner_count
    FROM (
      SELECT k, COUNT(*)::int AS c
      FROM (
        SELECT CASE WHEN (side_a_user_ids[1])::text < (side_a_user_ids[2])::text
                    THEN (side_a_user_ids[1])::text || '|' || (side_a_user_ids[2])::text
                    ELSE (side_a_user_ids[2])::text || '|' || (side_a_user_ids[1])::text END AS k
          FROM public.tournament_matches
         WHERE tournament_category_id = _category_id
           AND phase = 'americano'
           AND array_length(side_a_user_ids,1) = 2
        UNION ALL
        SELECT CASE WHEN (side_b_user_ids[1])::text < (side_b_user_ids[2])::text
                    THEN (side_b_user_ids[1])::text || '|' || (side_b_user_ids[2])::text
                    ELSE (side_b_user_ids[2])::text || '|' || (side_b_user_ids[1])::text END AS k
          FROM public.tournament_matches
         WHERE tournament_category_id = _category_id
           AND phase = 'americano'
           AND array_length(side_b_user_ids,1) = 2
      ) s GROUP BY k
    ) t;
  END IF;

  INSERT INTO public.americano_rounds (tenant_id, tournament_category_id, round_number, status)
  VALUES (v_cat.tenant_id, _category_id, _round_number, 'pendiente')
  RETURNING id INTO v_round_id;

  v_remaining := v_players;
  IF (v_player_count % 4) <> 0 THEN
    v_bye := v_remaining[v_player_count - (v_player_count % 4) + 1 : v_player_count];
    v_remaining := v_remaining[1 : v_player_count - (v_player_count % 4)];
    UPDATE public.americano_rounds SET bye_user_ids = v_bye WHERE id = v_round_id;
  END IF;

  WHILE array_length(v_remaining,1) >= 4 LOOP
    v_table_num := v_table_num + 1;

    v_a1 := v_remaining[1];
    v_best_partner := NULL;
    v_best_score := NULL;
    FOREACH v_other IN ARRAY v_remaining[2:array_length(v_remaining,1)] LOOP
      v_pair_key := CASE WHEN v_a1::text < v_other::text
        THEN v_a1::text || '|' || v_other::text
        ELSE v_other::text || '|' || v_a1::text END;
      v_score := COALESCE((v_partner_count->>v_pair_key)::int, 0);
      IF v_best_score IS NULL OR v_score < v_best_score THEN
        v_best_score := v_score;
        v_best_partner := v_other;
      END IF;
    END LOOP;
    v_a2 := v_best_partner;
    v_remaining := array_remove(array_remove(v_remaining, v_a1), v_a2);

    v_b1 := v_remaining[1];
    v_best_partner := NULL;
    v_best_score := NULL;
    FOREACH v_other IN ARRAY v_remaining[2:array_length(v_remaining,1)] LOOP
      v_pair_key := CASE WHEN v_b1::text < v_other::text
        THEN v_b1::text || '|' || v_other::text
        ELSE v_other::text || '|' || v_b1::text END;
      v_score := COALESCE((v_partner_count->>v_pair_key)::int, 0);
      IF v_best_score IS NULL OR v_score < v_best_score THEN
        v_best_score := v_score;
        v_best_partner := v_other;
      END IF;
    END LOOP;
    v_b2 := v_best_partner;
    v_remaining := array_remove(array_remove(v_remaining, v_b1), v_b2);

    INSERT INTO public.tournament_matches (
      tournament_id, tenant_id, tournament_category_id, round, bracket_position,
      phase, americano_round_id, side_a_user_ids, side_b_user_ids, status,
      acceptance_a, acceptance_b
    ) VALUES (
      v_cat.tournament_id, v_cat.tenant_id, _category_id, _round_number, v_table_num,
      'americano', v_round_id, ARRAY[v_a1, v_a2], ARRAY[v_b1, v_b2], 'pendiente'::match_status,
      'pending'::match_acceptance_status, 'pending'::match_acceptance_status
    );

    v_pair_key := CASE WHEN v_a1::text < v_a2::text
      THEN v_a1::text || '|' || v_a2::text ELSE v_a2::text || '|' || v_a1::text END;
    v_partner_count := jsonb_set(v_partner_count, ARRAY[v_pair_key],
      to_jsonb(COALESCE((v_partner_count->>v_pair_key)::int,0) + 1));
    v_pair_key := CASE WHEN v_b1::text < v_b2::text
      THEN v_b1::text || '|' || v_b2::text ELSE v_b2::text || '|' || v_b1::text END;
    v_partner_count := jsonb_set(v_partner_count, ARRAY[v_pair_key],
      to_jsonb(COALESCE((v_partner_count->>v_pair_key)::int,0) + 1));
  END LOOP;

  RETURN v_round_id;
END;
$function$;