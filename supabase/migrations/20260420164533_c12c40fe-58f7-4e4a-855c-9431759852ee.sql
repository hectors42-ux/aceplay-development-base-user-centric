CREATE OR REPLACE FUNCTION public.get_player_streak(_user_id uuid, _sport rating_sport)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _streak integer := 0;
  _last_won boolean := NULL;
  _row record;
BEGIN
  FOR _row IN
    SELECT delta
    FROM public.rating_history
    WHERE user_id = _user_id
      AND sport = _sport
      AND source IN ('tournament_match', 'ladder_challenge')
    ORDER BY recorded_at DESC
    LIMIT 20
  LOOP
    IF _last_won IS NULL THEN
      _last_won := _row.delta > 0;
      _streak := CASE WHEN _last_won THEN 1 ELSE -1 END;
    ELSIF (_row.delta > 0) = _last_won THEN
      _streak := _streak + CASE WHEN _last_won THEN 1 ELSE -1 END;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN _streak;
END;
$function$;