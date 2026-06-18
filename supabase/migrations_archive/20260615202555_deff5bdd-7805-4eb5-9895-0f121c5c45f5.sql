
-- =====================================================================
-- PRD 2 · swap_americano_players
-- =====================================================================
CREATE OR REPLACE FUNCTION public.swap_americano_players(
  _round_id uuid,
  _swaps jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round       public.americano_rounds%ROWTYPE;
  v_category    public.tournament_categories%ROWTYPE;
  v_tenant_id   uuid;
  v_tournament_id uuid;
  v_swap        jsonb;
  v_from        uuid;
  v_to          uuid;
  v_match_id    uuid;
  v_match       public.tournament_matches%ROWTYPE;
  v_affected    uuid[] := '{}'::uuid[];
  v_users_in_round uuid[];
  v_dup_check   int;
  v_pair_key    text;
  v_existing_pairs jsonb;
  v_a uuid; v_b uuid;
BEGIN
  SELECT * INTO v_round FROM public.americano_rounds WHERE id = _round_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ronda no encontrada'; END IF;

  SELECT * INTO v_category FROM public.tournament_categories WHERE id = v_round.tournament_category_id;
  v_tenant_id := v_round.tenant_id;
  v_tournament_id := v_category.tournament_id;

  -- Autorización: solo admins del tenant
  IF NOT (
    public.has_role(auth.uid(), 'club_admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden editar parejas';
  END IF;

  IF v_round.status = 'finalizada' THEN
    RAISE EXCEPTION 'No se puede editar una ronda finalizada';
  END IF;

  -- Aplicar cada swap
  FOR v_swap IN SELECT * FROM jsonb_array_elements(COALESCE(_swaps, '[]'::jsonb))
  LOOP
    v_from := (v_swap->>'from_user_id')::uuid;
    v_to := (v_swap->>'to_user_id')::uuid;
    v_match_id := (v_swap->>'match_id')::uuid;

    IF v_from IS NULL OR v_to IS NULL OR v_from = v_to THEN
      CONTINUE;
    END IF;

    -- Localizar ambos matches (origen y destino del jugador 'to')
    -- Estrategia: cambiar v_from por v_to en su match actual y v_to por v_from en el suyo.
    UPDATE public.tournament_matches
       SET side_a_user_ids = array_replace(side_a_user_ids, v_from, v_to),
           side_b_user_ids = array_replace(side_b_user_ids, v_from, v_to),
           updated_at = now()
     WHERE americano_round_id = _round_id
       AND (v_from = ANY(side_a_user_ids) OR v_from = ANY(side_b_user_ids))
       AND status IN ('pendiente','programado');

    UPDATE public.tournament_matches
       SET side_a_user_ids = array_replace(side_a_user_ids, v_to, v_from),
           side_b_user_ids = array_replace(side_b_user_ids, v_to, v_from),
           updated_at = now()
     WHERE americano_round_id = _round_id
       AND (v_to = ANY(side_a_user_ids) OR v_to = ANY(side_b_user_ids))
       AND id <> COALESCE(v_match_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND status IN ('pendiente','programado');

    v_affected := v_affected || ARRAY[v_from, v_to];
  END LOOP;

  -- Validar invariante: cada user_id aparece a lo más una vez en la ronda
  SELECT array_agg(u) INTO v_users_in_round
  FROM (
    SELECT unnest(side_a_user_ids || side_b_user_ids) AS u
      FROM public.tournament_matches
     WHERE americano_round_id = _round_id
  ) s
  WHERE u IS NOT NULL;

  SELECT COUNT(*) - COUNT(DISTINCT u) INTO v_dup_check FROM unnest(v_users_in_round) u;
  IF v_dup_check > 0 THEN
    RAISE EXCEPTION 'Swap inválido: un jugador queda en dos canchas';
  END IF;

  -- Validar anti-repetición contra rondas finalizadas previas
  SELECT COALESCE(jsonb_object_agg(k, true), '{}'::jsonb) INTO v_existing_pairs
  FROM (
    SELECT DISTINCT
      CASE WHEN side_a_user_ids[1]::text < side_a_user_ids[2]::text
           THEN side_a_user_ids[1]::text || '|' || side_a_user_ids[2]::text
           ELSE side_a_user_ids[2]::text || '|' || side_a_user_ids[1]::text END AS k
      FROM public.tournament_matches m
      JOIN public.americano_rounds r ON r.id = m.americano_round_id
     WHERE m.tournament_category_id = v_round.tournament_category_id
       AND r.id <> _round_id
       AND r.status = 'finalizada'
       AND m.side_a_user_ids IS NOT NULL AND array_length(m.side_a_user_ids,1) >= 2
    UNION
    SELECT DISTINCT
      CASE WHEN side_b_user_ids[1]::text < side_b_user_ids[2]::text
           THEN side_b_user_ids[1]::text || '|' || side_b_user_ids[2]::text
           ELSE side_b_user_ids[2]::text || '|' || side_b_user_ids[1]::text END
      FROM public.tournament_matches m
      JOIN public.americano_rounds r ON r.id = m.americano_round_id
     WHERE m.tournament_category_id = v_round.tournament_category_id
       AND r.id <> _round_id
       AND r.status = 'finalizada'
       AND m.side_b_user_ids IS NOT NULL AND array_length(m.side_b_user_ids,1) >= 2
  ) pairs;

  -- Chequear cada nueva pareja
  FOR v_a, v_b IN
    SELECT side_a_user_ids[1], side_a_user_ids[2]
      FROM public.tournament_matches
     WHERE americano_round_id = _round_id
       AND side_a_user_ids IS NOT NULL AND array_length(side_a_user_ids,1) >= 2
    UNION ALL
    SELECT side_b_user_ids[1], side_b_user_ids[2]
      FROM public.tournament_matches
     WHERE americano_round_id = _round_id
       AND side_b_user_ids IS NOT NULL AND array_length(side_b_user_ids,1) >= 2
  LOOP
    v_pair_key := CASE WHEN v_a::text < v_b::text
                       THEN v_a::text || '|' || v_b::text
                       ELSE v_b::text || '|' || v_a::text END;
    IF v_existing_pairs ? v_pair_key THEN
      RAISE EXCEPTION 'Swap inválido: la pareja % ya jugó en una ronda finalizada', v_pair_key;
    END IF;
  END LOOP;

  -- Registrar evento
  INSERT INTO public.tournament_events (tournament_id, tenant_id, kind, payload, actor)
  VALUES (v_tournament_id, v_tenant_id, 'partner_swap',
          jsonb_build_object('round_id', _round_id, 'swaps', _swaps, 'affected', to_jsonb(v_affected)),
          auth.uid());

  -- Notificar a jugadores afectados
  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, description, ref_id, link)
  SELECT DISTINCT v_tenant_id, u, 'partner_changed',
         'Tu pareja cambió',
         'El admin actualizó las parejas de tu próxima ronda.',
         v_tournament_id,
         '/torneos/' || v_tournament_id::text
    FROM unnest(v_affected) u
   WHERE u IS NOT NULL;

  RETURN jsonb_build_object('ok', true, 'affected_count', array_length(v_affected,1));
END
$$;

REVOKE ALL ON FUNCTION public.swap_americano_players(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.swap_americano_players(uuid, jsonb) TO authenticated;

-- =====================================================================
-- PRD 2 · regenerate_americano_rounds
-- =====================================================================
CREATE OR REPLACE FUNCTION public.regenerate_americano_rounds(
  _category_id uuid,
  _from_round int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category public.tournament_categories%ROWTYPE;
  v_tenant_id uuid;
  v_tournament_id uuid;
  v_round_numbers int[];
  v_n int;
  v_count int := 0;
BEGIN
  SELECT * INTO v_category FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;
  v_tenant_id := v_category.tenant_id;
  v_tournament_id := v_category.tournament_id;

  IF NOT (
    public.has_role(auth.uid(), 'club_admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden regenerar rondas';
  END IF;

  -- Capturar rondas a regenerar (las no finalizadas desde _from_round)
  SELECT array_agg(round_number ORDER BY round_number) INTO v_round_numbers
    FROM public.americano_rounds
   WHERE tournament_category_id = _category_id
     AND round_number >= _from_round
     AND status <> 'finalizada';

  IF v_round_numbers IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'regenerated', 0);
  END IF;

  -- Borrar (cascada elimina los matches por FK)
  DELETE FROM public.americano_rounds
   WHERE tournament_category_id = _category_id
     AND round_number = ANY(v_round_numbers);

  -- Regenerar en orden
  FOREACH v_n IN ARRAY v_round_numbers LOOP
    PERFORM public.generate_americano_round(_category_id, v_n, NULL::uuid);
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.tournament_events (tournament_id, tenant_id, kind, payload, actor)
  VALUES (v_tournament_id, v_tenant_id, 'rounds_regenerated',
          jsonb_build_object('category_id', _category_id, 'from_round', _from_round, 'rounds', to_jsonb(v_round_numbers)),
          auth.uid());

  RETURN jsonb_build_object('ok', true, 'regenerated', v_count);
END
$$;

REVOKE ALL ON FUNCTION public.regenerate_americano_rounds(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.regenerate_americano_rounds(uuid, int) TO authenticated;
