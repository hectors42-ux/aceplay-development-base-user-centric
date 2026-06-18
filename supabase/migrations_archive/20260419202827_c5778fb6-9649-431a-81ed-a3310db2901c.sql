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
  v_temp_pos integer;
BEGIN
  SELECT * INTO v_challenge FROM ladder_challenges WHERE id = _challenge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Desafío no encontrado';
  END IF;

  IF v_challenge.winner_user_id IS NULL THEN
    RAISE EXCEPTION 'El desafío no tiene ganador definido';
  END IF;

  SELECT * INTO v_ladder FROM ladders WHERE id = v_challenge.ladder_id;

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

  IF v_challenge.walkover THEN
    v_history_reason_winner := 'walkover';
    v_history_reason_loser := 'walkover';
  ELSE
    v_history_reason_winner := 'desafio_ganado';
    v_history_reason_loser := 'desafio_perdido';
  END IF;

  -- Valor temporal positivo y único para evitar colisiones con unique(ladder_id, position)
  -- Usamos un offset grande (>10000) que no colisiona con posiciones reales.
  v_temp_pos := 10000 + v_challenger_pos.position;

  IF v_challenger_won THEN
    v_winner_pos_before := v_challenger_pos.position;
    v_loser_pos_before := v_challenged_pos.position;
    v_winner_pos_after := v_challenged_pos.position;
    v_loser_pos_after := v_challenger_pos.position;

    UPDATE ladder_positions
       SET position = v_temp_pos,
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
    v_winner_pos_before := v_challenged_pos.position;
    v_winner_pos_after := v_challenged_pos.position;
    v_loser_pos_before := v_challenger_pos.position;

    UPDATE ladder_positions
       SET wins = wins + 1,
           walkovers_for = walkovers_for + CASE WHEN v_challenge.walkover THEN 1 ELSE 0 END,
           last_played_at = v_now,
           updated_at = v_now
     WHERE id = v_challenged_pos.id;

    IF v_ladder.loser_drops_position THEN
      DECLARE
        v_below ladder_positions%ROWTYPE;
        v_temp_pos2 integer;
      BEGIN
        SELECT * INTO v_below
          FROM ladder_positions
         WHERE ladder_id = v_challenge.ladder_id
           AND position = v_challenger_pos.position + 1
         FOR UPDATE;

        IF FOUND THEN
          v_loser_pos_after := v_challenger_pos.position + 1;
          v_temp_pos2 := 20000 + v_challenger_pos.position;

          UPDATE ladder_positions
             SET position = v_temp_pos2,
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

  INSERT INTO ladder_history (ladder_id, tenant_id, user_id, position_before, position_after, reason, challenge_id, recorded_at)
  VALUES (v_challenge.ladder_id, v_challenge.tenant_id, v_challenge.winner_user_id, v_winner_pos_before, v_winner_pos_after, v_history_reason_winner, _challenge_id, v_now);

  INSERT INTO ladder_history (ladder_id, tenant_id, user_id, position_before, position_after, reason, challenge_id, recorded_at)
  VALUES (
    v_challenge.ladder_id, v_challenge.tenant_id,
    CASE WHEN v_challenger_won THEN v_challenge.challenged_user_id ELSE v_challenge.challenger_user_id END,
    v_loser_pos_before, v_loser_pos_after, v_history_reason_loser, _challenge_id, v_now
  );
END;
$$;