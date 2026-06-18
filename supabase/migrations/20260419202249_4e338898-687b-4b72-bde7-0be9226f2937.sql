-- ============================================================
-- _apply_ladder_result: aplica el resultado al ladder
-- ============================================================
CREATE OR REPLACE FUNCTION public._apply_ladder_result(_challenge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge ladder_challenges%ROWTYPE;
  v_ladder ladders%ROWTYPE;
  v_challenger_pos ladder_positions%ROWTYPE;
  v_challenged_pos ladder_positions%ROWTYPE;
  v_winner_pos_before integer;
  v_winner_pos_after integer;
  v_loser_pos_before integer;
  v_loser_pos_after integer;
  v_challenger_won boolean;
  v_now timestamptz := now();
  v_history_reason_winner ladder_history_reason;
  v_history_reason_loser ladder_history_reason;
BEGIN
  SELECT * INTO v_challenge FROM ladder_challenges WHERE id = _challenge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Desafío no encontrado';
  END IF;

  IF v_challenge.winner_user_id IS NULL THEN
    RAISE EXCEPTION 'El desafío no tiene ganador definido';
  END IF;

  SELECT * INTO v_ladder FROM ladders WHERE id = v_challenge.ladder_id;

  -- Bloquear ambas posiciones para evitar carreras
  SELECT * INTO v_challenger_pos
    FROM ladder_positions
   WHERE ladder_id = v_challenge.ladder_id
     AND user_id = v_challenge.challenger_user_id
   FOR UPDATE;

  SELECT * INTO v_challenged_pos
    FROM ladder_positions
   WHERE ladder_id = v_challenge.ladder_id
     AND user_id = v_challenge.challenged_user_id
   FOR UPDATE;

  IF v_challenger_pos.id IS NULL OR v_challenged_pos.id IS NULL THEN
    RAISE EXCEPTION 'Uno de los jugadores no tiene posición activa en el ladder';
  END IF;

  v_challenger_won := (v_challenge.winner_user_id = v_challenge.challenger_user_id);

  -- Razones para el historial
  IF v_challenge.walkover THEN
    v_history_reason_winner := 'walkover';
    v_history_reason_loser := 'walkover';
  ELSE
    v_history_reason_winner := 'desafio_ganado';
    v_history_reason_loser := 'desafio_perdido';
  END IF;

  IF v_challenger_won THEN
    -- Retador gana: intercambio de posiciones
    v_winner_pos_before := v_challenger_pos.position;
    v_loser_pos_before := v_challenged_pos.position;
    v_winner_pos_after := v_challenged_pos.position;
    v_loser_pos_after := v_challenger_pos.position;

    -- Movimiento atómico evitando colisión de unique (ladder_id, position)
    UPDATE ladder_positions
       SET position = -1,
           updated_at = v_now
     WHERE id = v_challenger_pos.id;

    UPDATE ladder_positions
       SET position = v_loser_pos_after,
           losses = losses + 1,
           walkovers_against = walkovers_against + CASE WHEN v_challenge.walkover THEN 1 ELSE 0 END,
           last_played_at = v_now,
           updated_at = v_now
     WHERE id = v_challenged_pos.id;

    UPDATE ladder_positions
       SET position = v_winner_pos_after,
           wins = wins + 1,
           walkovers_for = walkovers_for + CASE WHEN v_challenge.walkover THEN 1 ELSE 0 END,
           last_played_at = v_now,
           updated_at = v_now
     WHERE id = v_challenger_pos.id;
  ELSE
    -- Desafiado gana: mantiene su posición
    v_winner_pos_before := v_challenged_pos.position;
    v_winner_pos_after := v_challenged_pos.position;
    v_loser_pos_before := v_challenger_pos.position;

    UPDATE ladder_positions
       SET wins = wins + 1,
           walkovers_for = walkovers_for + CASE WHEN v_challenge.walkover THEN 1 ELSE 0 END,
           last_played_at = v_now,
           updated_at = v_now
     WHERE id = v_challenged_pos.id;

    -- Regla opcional: el retador baja 1 puesto al perder
    IF v_ladder.loser_drops_position THEN
      DECLARE
        v_below ladder_positions%ROWTYPE;
      BEGIN
        SELECT * INTO v_below
          FROM ladder_positions
         WHERE ladder_id = v_challenge.ladder_id
           AND position = v_challenger_pos.position + 1
         FOR UPDATE;

        IF FOUND THEN
          v_loser_pos_after := v_challenger_pos.position + 1;

          UPDATE ladder_positions
             SET position = -1,
                 updated_at = v_now
           WHERE id = v_challenger_pos.id;

          UPDATE ladder_positions
             SET position = v_challenger_pos.position,
                 updated_at = v_now
           WHERE id = v_below.id;

          UPDATE ladder_positions
             SET position = v_loser_pos_after,
                 losses = losses + 1,
                 walkovers_against = walkovers_against + CASE WHEN v_challenge.walkover THEN 1 ELSE 0 END,
                 last_played_at = v_now,
                 updated_at = v_now
           WHERE id = v_challenger_pos.id;

          -- Registra el movimiento del jugador que sube
          INSERT INTO ladder_history (ladder_id, tenant_id, user_id, position_before, position_after, reason, challenge_id, recorded_at)
          VALUES (v_challenge.ladder_id, v_challenge.tenant_id, v_below.user_id, v_below.position, v_challenger_pos.position, 'ajuste_admin', _challenge_id, v_now);
        ELSE
          v_loser_pos_after := v_challenger_pos.position;
          UPDATE ladder_positions
             SET losses = losses + 1,
                 walkovers_against = walkovers_against + CASE WHEN v_challenge.walkover THEN 1 ELSE 0 END,
                 last_played_at = v_now,
                 updated_at = v_now
           WHERE id = v_challenger_pos.id;
        END IF;
      END;
    ELSE
      v_loser_pos_after := v_challenger_pos.position;
      UPDATE ladder_positions
         SET losses = losses + 1,
             walkovers_against = walkovers_against + CASE WHEN v_challenge.walkover THEN 1 ELSE 0 END,
             last_played_at = v_now,
             updated_at = v_now
       WHERE id = v_challenger_pos.id;
    END IF;
  END IF;

  -- Marcar desafío como jugado
  UPDATE ladder_challenges
     SET status = 'jugado',
         played_at = COALESCE(played_at, v_now),
         loser_user_id = CASE
           WHEN v_challenger_won THEN v_challenge.challenged_user_id
           ELSE v_challenge.challenger_user_id
         END,
         result_confirmed_at = v_now,
         updated_at = v_now
   WHERE id = _challenge_id;

  -- Historial: ganador
  INSERT INTO ladder_history (ladder_id, tenant_id, user_id, position_before, position_after, reason, challenge_id, recorded_at)
  VALUES (
    v_challenge.ladder_id,
    v_challenge.tenant_id,
    v_challenge.winner_user_id,
    v_winner_pos_before,
    v_winner_pos_after,
    v_history_reason_winner,
    _challenge_id,
    v_now
  );

  -- Historial: perdedor
  INSERT INTO ladder_history (ladder_id, tenant_id, user_id, position_before, position_after, reason, challenge_id, recorded_at)
  VALUES (
    v_challenge.ladder_id,
    v_challenge.tenant_id,
    CASE WHEN v_challenger_won THEN v_challenge.challenged_user_id ELSE v_challenge.challenger_user_id END,
    v_loser_pos_before,
    v_loser_pos_after,
    v_history_reason_loser,
    _challenge_id,
    v_now
  );
END;
$$;

-- ============================================================
-- submit_ladder_result: propone (o aplica) el resultado
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_ladder_result(
  _challenge_id uuid,
  _winner_user_id uuid,
  _score jsonb DEFAULT NULL,
  _retired boolean DEFAULT false,
  _walkover boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge ladder_challenges%ROWTYPE;
  v_ladder ladders%ROWTYPE;
  v_user uuid := auth.uid();
  v_is_admin boolean;
  v_is_party boolean;
  v_now timestamptz := now();
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_challenge FROM ladder_challenges WHERE id = _challenge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Desafío no encontrado';
  END IF;

  IF v_challenge.status NOT IN ('aceptado', 'programado') THEN
    RAISE EXCEPTION 'El desafío no está en un estado válido para registrar resultado (estado: %)', v_challenge.status;
  END IF;

  IF _winner_user_id NOT IN (v_challenge.challenger_user_id, v_challenge.challenged_user_id) THEN
    RAISE EXCEPTION 'El ganador debe ser uno de los jugadores del desafío';
  END IF;

  SELECT * INTO v_ladder FROM ladders WHERE id = v_challenge.ladder_id;

  v_is_admin := is_club_admin_of(v_user, v_challenge.tenant_id);
  v_is_party := (v_user IN (v_challenge.challenger_user_id, v_challenge.challenged_user_id));

  IF NOT v_is_admin AND NOT v_is_party THEN
    RAISE EXCEPTION 'No tienes permiso para registrar resultado en este desafío';
  END IF;

  -- Modo solo_admin
  IF v_ladder.result_validation_mode = 'solo_admin' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo un administrador puede registrar el resultado';
    END IF;

    UPDATE ladder_challenges
       SET winner_user_id = _winner_user_id,
           score = _score,
           retired = COALESCE(_retired, false),
           walkover = COALESCE(_walkover, false),
           result_proposed_by = v_user,
           result_proposed_at = v_now,
           updated_at = v_now
     WHERE id = _challenge_id;

    PERFORM _apply_ladder_result(_challenge_id);

    SELECT to_jsonb(c.*) INTO v_result FROM ladder_challenges c WHERE c.id = _challenge_id;
    RETURN jsonb_build_object('status', 'applied', 'challenge', v_result);
  END IF;

  -- Modos con propuesta de jugador
  IF NOT v_is_party AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Solo los jugadores del desafío pueden proponer el resultado';
  END IF;

  UPDATE ladder_challenges
     SET winner_user_id = _winner_user_id,
         score = _score,
         retired = COALESCE(_retired, false),
         walkover = COALESCE(_walkover, false),
         result_proposed_by = v_user,
         result_proposed_at = v_now,
         result_confirmed_at = NULL,
         updated_at = v_now
   WHERE id = _challenge_id;

  -- Si lo propone admin → aplica directo
  IF v_is_admin THEN
    PERFORM _apply_ladder_result(_challenge_id);
    SELECT to_jsonb(c.*) INTO v_result FROM ladder_challenges c WHERE c.id = _challenge_id;
    RETURN jsonb_build_object('status', 'applied', 'challenge', v_result);
  END IF;

  SELECT to_jsonb(c.*) INTO v_result FROM ladder_challenges c WHERE c.id = _challenge_id;
  RETURN jsonb_build_object(
    'status', 'pending_confirmation',
    'mode', v_ladder.result_validation_mode,
    'challenge', v_result
  );
END;
$$;

-- ============================================================
-- confirm_ladder_result: confirma propuesta pendiente
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_ladder_result(_challenge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge ladder_challenges%ROWTYPE;
  v_ladder ladders%ROWTYPE;
  v_user uuid := auth.uid();
  v_is_admin boolean;
  v_is_party boolean;
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_challenge FROM ladder_challenges WHERE id = _challenge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Desafío no encontrado';
  END IF;

  IF v_challenge.result_proposed_at IS NULL OR v_challenge.winner_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay un resultado propuesto pendiente de confirmación';
  END IF;

  IF v_challenge.status = 'jugado' THEN
    RAISE EXCEPTION 'El resultado ya está confirmado';
  END IF;

  SELECT * INTO v_ladder FROM ladders WHERE id = v_challenge.ladder_id;
  v_is_admin := is_club_admin_of(v_user, v_challenge.tenant_id);
  v_is_party := (v_user IN (v_challenge.challenger_user_id, v_challenge.challenged_user_id));

  IF v_ladder.result_validation_mode = 'jugadores_con_confirmacion' THEN
    -- Debe confirmar un jugador distinto al que propuso
    IF NOT v_is_party THEN
      RAISE EXCEPTION 'Solo un jugador del desafío puede confirmar el resultado';
    END IF;
    IF v_user = v_challenge.result_proposed_by THEN
      RAISE EXCEPTION 'No puedes confirmar tu propia propuesta';
    END IF;
  ELSIF v_ladder.result_validation_mode = 'jugadores_con_aprobacion_admin' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo un administrador puede aprobar el resultado';
    END IF;
  ELSE
    -- solo_admin: ya se aplicó en submit; no debería llegar aquí
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Modo de validación no requiere confirmación adicional';
    END IF;
  END IF;

  PERFORM _apply_ladder_result(_challenge_id);

  SELECT to_jsonb(c.*) INTO v_result FROM ladder_challenges c WHERE c.id = _challenge_id;
  RETURN jsonb_build_object('status', 'applied', 'challenge', v_result);
END;
$$;

-- ============================================================
-- reject_ladder_result: rechaza propuesta pendiente
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_ladder_result(
  _challenge_id uuid,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge ladder_challenges%ROWTYPE;
  v_ladder ladders%ROWTYPE;
  v_user uuid := auth.uid();
  v_is_admin boolean;
  v_is_party boolean;
  v_new_status ladder_challenge_status;
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_challenge FROM ladder_challenges WHERE id = _challenge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Desafío no encontrado';
  END IF;

  IF v_challenge.result_proposed_at IS NULL THEN
    RAISE EXCEPTION 'No hay un resultado propuesto pendiente';
  END IF;

  IF v_challenge.status = 'jugado' THEN
    RAISE EXCEPTION 'El resultado ya fue confirmado y no puede rechazarse';
  END IF;

  SELECT * INTO v_ladder FROM ladders WHERE id = v_challenge.ladder_id;
  v_is_admin := is_club_admin_of(v_user, v_challenge.tenant_id);
  v_is_party := (v_user IN (v_challenge.challenger_user_id, v_challenge.challenged_user_id));

  IF v_ladder.result_validation_mode = 'jugadores_con_confirmacion' THEN
    IF NOT v_is_party THEN
      RAISE EXCEPTION 'Solo un jugador del desafío puede rechazar el resultado';
    END IF;
    IF v_user = v_challenge.result_proposed_by THEN
      RAISE EXCEPTION 'No puedes rechazar tu propia propuesta';
    END IF;
  ELSIF v_ladder.result_validation_mode = 'jugadores_con_aprobacion_admin' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo un administrador puede rechazar el resultado';
    END IF;
  ELSE
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'No tienes permiso para rechazar';
    END IF;
  END IF;

  -- Devolver el desafío al estado previo (programado si tenía agenda, aceptado si no)
  v_new_status := CASE
    WHEN v_challenge.scheduled_at IS NOT NULL THEN 'programado'::ladder_challenge_status
    ELSE 'aceptado'::ladder_challenge_status
  END;

  UPDATE ladder_challenges
     SET winner_user_id = NULL,
         loser_user_id = NULL,
         score = NULL,
         retired = false,
         walkover = false,
         result_proposed_by = NULL,
         result_proposed_at = NULL,
         result_confirmed_at = NULL,
         reject_reason = _reason,
         status = v_new_status,
         updated_at = now()
   WHERE id = _challenge_id;

  SELECT to_jsonb(c.*) INTO v_result FROM ladder_challenges c WHERE c.id = _challenge_id;
  RETURN jsonb_build_object('status', 'rejected', 'challenge', v_result);
END;
$$;