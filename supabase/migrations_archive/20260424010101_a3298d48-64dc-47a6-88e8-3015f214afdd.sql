
CREATE OR REPLACE FUNCTION public.submit_match_result(
  _match_id UUID,
  _winner_registration_id UUID,
  _score JSONB DEFAULT NULL,
  _walkover BOOLEAN DEFAULT false,
  _retired BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match public.tournament_matches%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_category public.tournament_categories%ROWTYPE;
  v_is_admin BOOLEAN;
  v_is_player BOOLEAN;
  v_proposal public.tournament_match_results%ROWTYPE;
  v_applied public.tournament_matches%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El partido no existe'; END IF;
  IF v_match.status IN ('jugado','walkover','cancelado') THEN
    RAISE EXCEPTION 'El partido ya tiene resultado';
  END IF;
  IF v_match.registration_a_id IS NULL OR v_match.registration_b_id IS NULL THEN
    RAISE EXCEPTION 'El partido aún no tiene contendientes definidos';
  END IF;
  IF _winner_registration_id NOT IN (v_match.registration_a_id, v_match.registration_b_id) THEN
    RAISE EXCEPTION 'El ganador debe ser uno de los dos contendientes';
  END IF;

  SELECT * INTO v_category FROM public.tournament_categories WHERE id = v_match.category_id;
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;

  v_is_admin := public.is_club_admin_of(v_user_id, v_match.tenant_id);
  v_is_player := public.is_match_player(v_user_id, _match_id);

  IF NOT (v_is_admin OR v_is_player) THEN
    RAISE EXCEPTION 'No tienes permiso para registrar este resultado';
  END IF;

  -- Cancelar propuesta pendiente previa
  UPDATE public.tournament_match_results
    SET status = 'rechazado', responded_at = now(), responded_by = v_user_id, reject_reason = 'Reemplazada'
    WHERE match_id = _match_id AND status = 'propuesto';

  -- Admin siempre puede aplicar directo
  IF v_is_admin THEN
    v_applied := public._apply_match_result(_match_id, _winner_registration_id, _score, _walkover, _retired);
    RETURN jsonb_build_object('mode','aplicado','match_id', v_applied.id);
  END IF;

  -- Modos para jugadores
  IF v_tournament.result_validation_mode = 'solo_admin' THEN
    RAISE EXCEPTION 'Solo el administrador puede registrar resultados en este torneo';
  END IF;

  -- jugadores_con_confirmacion o jugadores_con_aprobacion_admin → crear propuesta
  INSERT INTO public.tournament_match_results (
    match_id, tenant_id, proposed_by, winner_registration_id,
    score, walkover, retired
  ) VALUES (
    _match_id, v_match.tenant_id, v_user_id, _winner_registration_id,
    _score, _walkover, _retired
  ) RETURNING * INTO v_proposal;

  RETURN jsonb_build_object(
    'mode', CASE WHEN v_tournament.result_validation_mode = 'jugadores_con_confirmacion' THEN 'pendiente_rival' ELSE 'pendiente_admin' END,
    'proposal_id', v_proposal.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_match_result(_proposal_id UUID, _reason TEXT DEFAULT NULL)
RETURNS public.tournament_match_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_proposal public.tournament_match_results%ROWTYPE;
  v_is_admin BOOLEAN;
  v_is_opponent BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_proposal FROM public.tournament_match_results WHERE id = _proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Propuesta no encontrada'; END IF;
  IF v_proposal.status <> 'propuesto' THEN RAISE EXCEPTION 'La propuesta no está pendiente'; END IF;

  v_is_admin := public.is_club_admin_of(v_user_id, v_proposal.tenant_id);
  v_is_opponent := public.is_match_player(v_user_id, v_proposal.match_id) AND v_user_id <> v_proposal.proposed_by;
  IF NOT (v_is_admin OR v_is_opponent) THEN
    RAISE EXCEPTION 'No puedes rechazar esta propuesta';
  END IF;

  UPDATE public.tournament_match_results
  SET status = 'rechazado', responded_by = v_user_id, responded_at = now(), reject_reason = _reason
  WHERE id = _proposal_id
  RETURNING * INTO v_proposal;
  RETURN v_proposal;
END;
$$;
