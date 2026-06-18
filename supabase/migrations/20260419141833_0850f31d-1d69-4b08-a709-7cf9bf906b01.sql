CREATE OR REPLACE FUNCTION public.generate_bracket(_category_id uuid, _seed_order uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_category public.tournament_categories%ROWTYPE;
  v_count INTEGER;
  v_bracket_size INTEGER;
  v_total_rounds INTEGER;
  v_regs UUID[];
  v_a UUID;
  v_b UUID;
  v_match_id UUID;
  v_next_id UUID;
  v_next_slot CHAR(1);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_category FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La categoría no existe'; END IF;
  IF NOT public.is_club_admin_of(v_user_id, v_category.tenant_id) THEN
    RAISE EXCEPTION 'Solo administradores pueden generar la llave';
  END IF;
  IF v_category.bracket_generated_at IS NOT NULL THEN
    RAISE EXCEPTION 'La llave ya fue generada';
  END IF;

  IF _seed_order IS NOT NULL AND array_length(_seed_order, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(_seed_order) WITH ORDINALITY AS s(id, ord)
      WHERE s.id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.tournament_registrations r
          WHERE r.id = s.id AND r.category_id = _category_id AND r.status = 'confirmada'
        )
    ) THEN
      RAISE EXCEPTION 'El orden de seeding contiene inscripciones inválidas';
    END IF;
    v_regs := _seed_order;
  ELSE
    SELECT ARRAY_AGG(id ORDER BY (seed IS NULL), seed NULLS LAST, registered_at)
    INTO v_regs
    FROM public.tournament_registrations
    WHERE category_id = _category_id AND status = 'confirmada';
  END IF;

  v_count := COALESCE(array_length(v_regs, 1), 0);
  IF v_count < 2 THEN RAISE EXCEPTION 'Se necesitan al menos 2 inscripciones confirmadas'; END IF;

  v_bracket_size := 2;
  WHILE v_bracket_size < v_count LOOP v_bracket_size := v_bracket_size * 2; END LOOP;
  v_total_rounds := CEIL(LOG(2, v_bracket_size))::INTEGER;

  WHILE COALESCE(array_length(v_regs, 1), 0) < v_bracket_size LOOP
    v_regs := array_append(v_regs, NULL::UUID);
  END LOOP;

  FOR r IN REVERSE 1..v_total_rounds LOOP
    DECLARE v_m INTEGER := v_bracket_size / (2 ^ (v_total_rounds - r + 1))::INTEGER;
    BEGIN
      FOR p IN 1..v_m LOOP
        INSERT INTO public.tournament_matches (
          tournament_id, category_id, tenant_id, round, bracket_position
        ) VALUES (
          v_category.tournament_id, _category_id, v_category.tenant_id, r, p
        );
      END LOOP;
    END;
  END LOOP;

  UPDATE public.tournament_matches m
  SET next_match_id = nm.id,
      next_match_slot = CASE WHEN (m.bracket_position % 2) = 1 THEN 'a' ELSE 'b' END
  FROM public.tournament_matches nm
  WHERE m.category_id = _category_id
    AND nm.category_id = _category_id
    AND m.round > 1
    AND nm.round = m.round - 1
    AND nm.bracket_position = CEIL(m.bracket_position::NUMERIC / 2);

  FOR i IN 1..(v_bracket_size / 2) LOOP
    v_a := v_regs[(i - 1) * 2 + 1];
    v_b := v_regs[(i - 1) * 2 + 2];

    UPDATE public.tournament_matches
    SET registration_a_id = v_a,
        registration_b_id = v_b,
        status = (CASE
          WHEN v_a IS NULL OR v_b IS NULL THEN 'walkover'
          ELSE 'pendiente'
        END)::public.match_status,
        winner_registration_id = CASE
          WHEN v_a IS NOT NULL AND v_b IS NULL THEN v_a
          WHEN v_b IS NOT NULL AND v_a IS NULL THEN v_b
          ELSE NULL
        END,
        walkover = (v_a IS NULL OR v_b IS NULL)
    WHERE category_id = _category_id
      AND round = v_total_rounds
      AND bracket_position = i;
  END LOOP;

  FOR v_match_id, v_a, v_next_id, v_next_slot IN
    SELECT id, winner_registration_id, next_match_id, next_match_slot
    FROM public.tournament_matches
    WHERE category_id = _category_id
      AND round = v_total_rounds
      AND walkover = true
      AND winner_registration_id IS NOT NULL
      AND next_match_id IS NOT NULL
  LOOP
    UPDATE public.tournament_matches
    SET registration_a_id = CASE WHEN v_next_slot = 'a' THEN v_a ELSE registration_a_id END,
        registration_b_id = CASE WHEN v_next_slot = 'b' THEN v_a ELSE registration_b_id END
    WHERE id = v_next_id;
  END LOOP;

  UPDATE public.tournament_categories
  SET bracket_generated_at = now(), status = 'en_curso'
  WHERE id = _category_id;

  UPDATE public.tournaments
  SET status = 'en_curso'
  WHERE id = v_category.tournament_id
    AND status IN ('borrador', 'inscripciones_abiertas', 'inscripciones_cerradas');

  RETURN v_total_rounds;
END;
$function$;