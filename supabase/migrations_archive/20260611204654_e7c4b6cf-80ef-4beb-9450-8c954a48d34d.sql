CREATE OR REPLACE FUNCTION public.generate_consolation(_category_id uuid, _seed_order uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_category public.tournament_categories%ROWTYPE;
  v_count INTEGER;
  v_main_rounds INTEGER;
  v_main_size INTEGER;
  v_plate_size INTEGER;
  v_plate_rounds INTEGER;
  r INTEGER;
  p INTEGER;
  v_m INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_category FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La categoría no existe'; END IF;
  IF NOT public.is_club_admin_of(v_user_id, v_category.tenant_id) THEN
    RAISE EXCEPTION 'Solo administradores pueden generar la llave';
  END IF;

  v_count := public.generate_bracket(_category_id, _seed_order);

  SELECT MAX(round) INTO v_main_rounds
  FROM public.tournament_matches
  WHERE tournament_category_id = _category_id AND bracket = 'main';

  v_main_size := POWER(2, v_main_rounds)::INTEGER;
  v_plate_size := v_main_size / 2;
  IF v_plate_size < 2 THEN
    RETURN v_count;
  END IF;
  v_plate_rounds := v_main_rounds - 1;

  FOR r IN REVERSE 1..v_plate_rounds LOOP
    v_m := v_plate_size / POWER(2, v_plate_rounds - r + 1)::INTEGER;
    FOR p IN 1..v_m LOOP
      INSERT INTO public.tournament_matches (
        tournament_id, tournament_category_id, tenant_id, round, bracket_position, bracket
      ) VALUES (
        v_category.tournament_id, _category_id, v_category.tenant_id, r, p, 'plate'
      );
    END LOOP;
  END LOOP;

  UPDATE public.tournament_matches m
  SET next_match_id = nm.id,
      next_match_slot = CASE WHEN (m.bracket_position % 2) = 1 THEN 'a' ELSE 'b' END
  FROM public.tournament_matches nm
  WHERE m.tournament_category_id = _category_id AND m.bracket = 'plate'
    AND nm.tournament_category_id = _category_id AND nm.bracket = 'plate'
    AND m.round > 1
    AND nm.round = m.round - 1
    AND nm.bracket_position = CEIL(m.bracket_position::NUMERIC / 2);

  UPDATE public.tournament_matches m
  SET loser_next_match_id = pm.id,
      loser_next_match_slot = CASE WHEN (m.bracket_position % 2) = 1 THEN 'a' ELSE 'b' END
  FROM public.tournament_matches pm
  WHERE m.tournament_category_id = _category_id
    AND m.bracket = 'main'
    AND m.round = v_main_rounds
    AND pm.tournament_category_id = _category_id
    AND pm.bracket = 'plate'
    AND pm.round = v_plate_rounds
    AND pm.bracket_position = CEIL(m.bracket_position::NUMERIC / 2);

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_double_elimination(_category_id uuid, _seed_order uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_category public.tournament_categories%ROWTYPE;
  v_count INTEGER;
  v_rounds INTEGER;
  v_size INTEGER;
  v_losers_rounds INTEGER;
  v_grand_final_id UUID;
  v_winners_final_id UUID;
  k INTEGER;
  p INTEGER;
  v_m INTEGER;
  v_lr INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_category FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La categoría no existe'; END IF;
  IF NOT public.is_club_admin_of(v_user_id, v_category.tenant_id) THEN
    RAISE EXCEPTION 'Solo administradores pueden generar la llave';
  END IF;

  v_count := public.generate_bracket(_category_id, _seed_order);

  SELECT MAX(round) INTO v_rounds
  FROM public.tournament_matches WHERE tournament_category_id = _category_id AND bracket = 'main';
  v_size := POWER(2, v_rounds)::INTEGER;
  IF v_rounds < 2 THEN
    RAISE EXCEPTION 'Doble eliminación requiere al menos 4 inscritos';
  END IF;
  v_losers_rounds := 2 * (v_rounds - 1);

  UPDATE public.tournament_matches
  SET bracket = 'winners', round = round + 1
  WHERE tournament_category_id = _category_id AND bracket = 'main';

  SELECT id INTO v_winners_final_id
  FROM public.tournament_matches
  WHERE tournament_category_id = _category_id AND bracket = 'winners' AND round = 2;

  INSERT INTO public.tournament_matches (
    tournament_id, tournament_category_id, tenant_id, round, bracket_position, bracket
  ) VALUES (
    v_category.tournament_id, _category_id, v_category.tenant_id, 1, 1, 'grand_final'
  ) RETURNING id INTO v_grand_final_id;

  UPDATE public.tournament_matches
  SET next_match_id = v_grand_final_id, next_match_slot = 'a'
  WHERE id = v_winners_final_id;

  FOR k IN 1..(v_rounds - 1) LOOP
    v_m := v_size / POWER(2, k + 1)::INTEGER;
    v_lr := v_losers_rounds + 3 - (2*k - 1);
    FOR p IN 1..v_m LOOP
      INSERT INTO public.tournament_matches (
        tournament_id, tournament_category_id, tenant_id, round, bracket_position, bracket
      ) VALUES (
        v_category.tournament_id, _category_id, v_category.tenant_id, v_lr, p, 'losers'
      );
    END LOOP;
    v_lr := v_losers_rounds + 3 - (2*k);
    FOR p IN 1..v_m LOOP
      INSERT INTO public.tournament_matches (
        tournament_id, tournament_category_id, tenant_id, round, bracket_position, bracket
      ) VALUES (
        v_category.tournament_id, _category_id, v_category.tenant_id, v_lr, p, 'losers'
      );
    END LOOP;
  END LOOP;

  FOR k IN 1..(v_rounds - 1) LOOP
    UPDATE public.tournament_matches src
    SET next_match_id = dst.id, next_match_slot = 'a'
    FROM public.tournament_matches dst
    WHERE src.tournament_category_id = _category_id AND src.bracket = 'losers'
      AND src.round = v_losers_rounds + 3 - (2*k - 1)
      AND dst.tournament_category_id = _category_id AND dst.bracket = 'losers'
      AND dst.round = v_losers_rounds + 3 - (2*k)
      AND dst.bracket_position = src.bracket_position;
  END LOOP;

  FOR k IN 1..(v_rounds - 2) LOOP
    UPDATE public.tournament_matches src
    SET next_match_id = dst.id,
        next_match_slot = CASE WHEN (src.bracket_position % 2) = 1 THEN 'a' ELSE 'b' END
    FROM public.tournament_matches dst
    WHERE src.tournament_category_id = _category_id AND src.bracket = 'losers'
      AND src.round = v_losers_rounds + 3 - (2*k)
      AND dst.tournament_category_id = _category_id AND dst.bracket = 'losers'
      AND dst.round = v_losers_rounds + 3 - (2*k + 1)
      AND dst.bracket_position = CEIL(src.bracket_position::NUMERIC / 2);
  END LOOP;

  UPDATE public.tournament_matches
  SET next_match_id = v_grand_final_id, next_match_slot = 'b'
  WHERE tournament_category_id = _category_id AND bracket = 'losers' AND round = 3;

  UPDATE public.tournament_matches src
  SET loser_next_match_id = dst.id,
      loser_next_match_slot = CASE WHEN (src.bracket_position % 2) = 1 THEN 'a' ELSE 'b' END
  FROM public.tournament_matches dst
  WHERE src.tournament_category_id = _category_id AND src.bracket = 'winners'
    AND src.round = v_rounds + 1
    AND dst.tournament_category_id = _category_id AND dst.bracket = 'losers'
    AND dst.round = v_losers_rounds + 2
    AND dst.bracket_position = CEIL(src.bracket_position::NUMERIC / 2);

  FOR k IN 1..(v_rounds - 1) LOOP
    UPDATE public.tournament_matches src
    SET loser_next_match_id = dst.id,
        loser_next_match_slot = 'b'
    FROM public.tournament_matches dst
    WHERE src.tournament_category_id = _category_id AND src.bracket = 'winners'
      AND src.round = v_rounds - k + 1
      AND dst.tournament_category_id = _category_id AND dst.bracket = 'losers'
      AND dst.round = v_losers_rounds + 3 - (2*k)
      AND dst.bracket_position = src.bracket_position;
  END LOOP;

  RETURN v_count;
END;
$$;