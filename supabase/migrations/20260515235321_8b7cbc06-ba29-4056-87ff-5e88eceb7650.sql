CREATE OR REPLACE FUNCTION public._apply_match_result(_match_id uuid, _winner_registration_id uuid, _score jsonb, _walkover boolean, _retired boolean)
 RETURNS tournament_matches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_pending INTEGER;
BEGIN
  UPDATE public.tournament_matches
  SET winner_registration_id = _winner_registration_id,
      score = _score,
      walkover = _walkover,
      retired = _retired,
      status = (CASE WHEN _walkover THEN 'walkover' ELSE 'jugado' END)::public.match_status,
      played_at = COALESCE(played_at, now())
  WHERE id = _match_id
  RETURNING * INTO v_match;

  IF v_match.next_match_id IS NOT NULL THEN
    UPDATE public.tournament_matches
    SET registration_a_id = CASE WHEN v_match.next_match_slot = 'a' THEN _winner_registration_id ELSE registration_a_id END,
        registration_b_id = CASE WHEN v_match.next_match_slot = 'b' THEN _winner_registration_id ELSE registration_b_id END
    WHERE id = v_match.next_match_id;
  END IF;

  IF v_match.round = 1 THEN
    UPDATE public.tournament_categories SET status = 'finalizado' WHERE id = v_match.category_id;

    SELECT COUNT(*) INTO v_pending
    FROM public.tournament_categories
    WHERE tournament_id = v_match.tournament_id AND status <> 'finalizado';

    IF v_pending = 0 THEN
      UPDATE public.tournaments SET status = 'finalizado' WHERE id = v_match.tournament_id;
    END IF;
  END IF;

  RETURN v_match;
END;
$function$;