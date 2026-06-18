-- 1) Helper interno: aplica recalculo Elo a un par de equipos (singles o dobles)
-- _winner_users / _loser_users son arrays de uuid (1 elemento singles, 2 dobles)
CREATE OR REPLACE FUNCTION public._apply_rating_for_match(
  _winner_users uuid[],
  _loser_users uuid[],
  _sport public.rating_sport,
  _source public.rating_change_source,
  _source_ref_id uuid,
  _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner_avg numeric;
  v_loser_avg numeric;
  v_uid uuid;
  v_exists boolean;
BEGIN
  -- Promedio de niveles del equipo ganador
  SELECT COALESCE(AVG(pr.level), 0)
    INTO v_winner_avg
    FROM public.player_ratings pr
   WHERE pr.user_id = ANY(_winner_users) AND pr.sport = _sport;

  SELECT COALESCE(AVG(pr.level), 0)
    INTO v_loser_avg
    FROM public.player_ratings pr
   WHERE pr.user_id = ANY(_loser_users) AND pr.sport = _sport;

  -- Ganadores
  FOREACH v_uid IN ARRAY _winner_users LOOP
    SELECT EXISTS(SELECT 1 FROM public.player_ratings WHERE user_id = v_uid AND sport = _sport)
      INTO v_exists;
    IF v_exists THEN
      PERFORM public.recalculate_rating_after_match(
        v_uid, v_loser_avg, true, _sport, _source, _source_ref_id, _notes
      );
    END IF;
  END LOOP;

  -- Perdedores
  FOREACH v_uid IN ARRAY _loser_users LOOP
    SELECT EXISTS(SELECT 1 FROM public.player_ratings WHERE user_id = v_uid AND sport = _sport)
      INTO v_exists;
    IF v_exists THEN
      PERFORM public.recalculate_rating_after_match(
        v_uid, v_winner_avg, false, _sport, _source, _source_ref_id, _notes
      );
    END IF;
  END LOOP;
END;
$$;

-- 2) Trigger function para ladder_challenges
CREATE OR REPLACE FUNCTION public._tg_rating_on_ladder_challenge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ladder public.ladders%ROWTYPE;
  v_sport public.rating_sport;
  v_winner_user uuid;
  v_loser_user uuid;
BEGIN
  -- Solo cuando pasa a jugado, no era jugado antes, hay ganador/perdedor, y no es walkover
  IF NEW.status <> 'jugado' THEN RETURN NEW; END IF;
  IF OLD.status = 'jugado' THEN RETURN NEW; END IF;
  IF NEW.walkover THEN RETURN NEW; END IF;
  IF NEW.winner_user_id IS NULL OR NEW.loser_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_ladder FROM public.ladders WHERE id = NEW.ladder_id;
  -- Mapear discipline (enum tournament_discipline) → rating_sport
  v_sport := CASE v_ladder.discipline::text
    WHEN 'tenis_singles' THEN 'tenis_singles'::public.rating_sport
    WHEN 'tenis_dobles'  THEN 'tenis_dobles'::public.rating_sport
    ELSE 'tenis_singles'::public.rating_sport
  END;

  v_winner_user := NEW.winner_user_id;
  v_loser_user  := NEW.loser_user_id;

  PERFORM public._apply_rating_for_match(
    ARRAY[v_winner_user],
    ARRAY[v_loser_user],
    v_sport,
    'ladder_challenge'::public.rating_change_source,
    NEW.id,
    'Ladder challenge result'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rating_on_ladder_challenge ON public.ladder_challenges;
CREATE TRIGGER trg_rating_on_ladder_challenge
AFTER UPDATE ON public.ladder_challenges
FOR EACH ROW
EXECUTE FUNCTION public._tg_rating_on_ladder_challenge();

-- 3) Trigger function para tournament_matches
CREATE OR REPLACE FUNCTION public._tg_rating_on_tournament_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat public.tournament_categories%ROWTYPE;
  v_sport public.rating_sport;
  v_winner_reg public.tournament_registrations%ROWTYPE;
  v_loser_reg public.tournament_registrations%ROWTYPE;
  v_winners uuid[];
  v_losers uuid[];
BEGIN
  IF NEW.status <> 'jugado' THEN RETURN NEW; END IF;
  IF OLD.status = 'jugado' THEN RETURN NEW; END IF;
  IF NEW.walkover THEN RETURN NEW; END IF;
  IF NEW.winner_registration_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.registration_a_id IS NULL OR NEW.registration_b_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = NEW.category_id;
  v_sport := CASE v_cat.discipline::text
    WHEN 'tenis_singles' THEN 'tenis_singles'::public.rating_sport
    WHEN 'tenis_dobles'  THEN 'tenis_dobles'::public.rating_sport
    ELSE 'tenis_singles'::public.rating_sport
  END;

  SELECT * INTO v_winner_reg FROM public.tournament_registrations
    WHERE id = NEW.winner_registration_id;

  IF v_winner_reg.id = NEW.registration_a_id THEN
    SELECT * INTO v_loser_reg FROM public.tournament_registrations
      WHERE id = NEW.registration_b_id;
  ELSE
    SELECT * INTO v_loser_reg FROM public.tournament_registrations
      WHERE id = NEW.registration_a_id;
  END IF;

  v_winners := ARRAY[v_winner_reg.player1_user_id]
    || CASE WHEN v_winner_reg.player2_user_id IS NOT NULL
            THEN ARRAY[v_winner_reg.player2_user_id]
            ELSE ARRAY[]::uuid[] END;
  v_losers := ARRAY[v_loser_reg.player1_user_id]
    || CASE WHEN v_loser_reg.player2_user_id IS NOT NULL
            THEN ARRAY[v_loser_reg.player2_user_id]
            ELSE ARRAY[]::uuid[] END;

  PERFORM public._apply_rating_for_match(
    v_winners,
    v_losers,
    v_sport,
    'tournament_match'::public.rating_change_source,
    NEW.id,
    'Tournament match result'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rating_on_tournament_match ON public.tournament_matches;
CREATE TRIGGER trg_rating_on_tournament_match
AFTER UPDATE ON public.tournament_matches
FOR EACH ROW
EXECUTE FUNCTION public._tg_rating_on_tournament_match();