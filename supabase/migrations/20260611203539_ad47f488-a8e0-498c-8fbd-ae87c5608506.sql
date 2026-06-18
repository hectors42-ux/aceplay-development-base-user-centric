
CREATE OR REPLACE FUNCTION public.submit_americano_result(
  _match_id uuid,
  _winner_side char(1),
  _score jsonb,
  _walkover boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_cat public.tournament_categories%ROWTYPE;
  v_round_id uuid;
  v_pending int;
  v_obs uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _winner_side NOT IN ('a','b') THEN RAISE EXCEPTION 'winner_side debe ser a o b'; END IF;

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no encontrado'; END IF;
  IF v_match.phase IS DISTINCT FROM 'americano' THEN
    RAISE EXCEPTION 'Este partido no pertenece al motor americano';
  END IF;

  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = v_match.tournament_category_id;
  IF NOT public.is_tournament_manager(v_cat.tournament_id) THEN
    RAISE EXCEPTION 'Solo el organizador puede cargar resultados de americano';
  END IF;

  UPDATE public.tournament_matches
     SET winner_side = _winner_side,
         score = CASE WHEN _walkover THEN NULL ELSE _score END,
         walkover = _walkover,
         status = 'jugado'::match_status,
         played_at = COALESCE(played_at, now()),
         updated_at = now()
   WHERE id = _match_id;

  v_round_id := v_match.americano_round_id;

  -- Emitir observación (idempotente)
  BEGIN
    v_obs := public.emit_match_observation(_match_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'emit_match_observation falló: %', SQLERRM;
  END;

  -- ¿Quedan partidos pendientes en la ronda?
  SELECT COUNT(*) INTO v_pending
    FROM public.tournament_matches
   WHERE americano_round_id = v_round_id
     AND status::text NOT IN ('jugado','walkover','cancelado');

  IF v_pending = 0 THEN
    UPDATE public.americano_rounds
      SET status = 'finalizada', updated_at = now()
    WHERE id = v_round_id;
  ELSE
    UPDATE public.americano_rounds
      SET status = 'en_juego', updated_at = now()
    WHERE id = v_round_id AND status = 'pendiente';
  END IF;

  RETURN _match_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_americano_result(uuid, char, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_americano_result(uuid, char, jsonb, boolean) TO authenticated, service_role;
