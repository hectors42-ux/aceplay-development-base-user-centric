CREATE OR REPLACE FUNCTION public.get_player_streak(_user_id uuid, _sport rating_sport)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
      AND source IN ('partido_torneo', 'partido_ladder', 'partido_amistoso')
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
$$;

CREATE OR REPLACE FUNCTION public.get_club_ranking(_sport rating_sport)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  level numeric,
  reliability integer,
  matches_played integer,
  category text,
  rank_position integer,
  prev_rank_position integer,
  streak integer,
  last_match_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
BEGIN
  _tenant_id := public.user_tenant_id(auth.uid());
  IF _tenant_id IS NULL AND NOT public.is_super_admin(auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH current_ranking AS (
    SELECT
      pr.user_id,
      pr.level,
      pr.reliability,
      pr.matches_played,
      pr.last_match_at,
      pr.tenant_id,
      ROW_NUMBER() OVER (ORDER BY pr.level DESC, pr.reliability DESC, pr.matches_played DESC)::integer AS pos
    FROM public.player_ratings pr
    WHERE pr.sport = _sport
      AND pr.tenant_id = _tenant_id
      AND pr.matches_played > 0
  ),
  prev_ranking AS (
    SELECT
      pr.user_id,
      COALESCE(
        (
          SELECT rh.level_after
          FROM public.rating_history rh
          WHERE rh.user_id = pr.user_id
            AND rh.sport = _sport
            AND rh.recorded_at <= now() - interval '7 days'
          ORDER BY rh.recorded_at DESC
          LIMIT 1
        ),
        pr.level
      ) AS prev_level
    FROM public.player_ratings pr
    WHERE pr.sport = _sport
      AND pr.tenant_id = _tenant_id
      AND pr.matches_played > 0
  ),
  prev_with_pos AS (
    SELECT
      pr2.user_id,
      ROW_NUMBER() OVER (ORDER BY pr2.prev_level DESC)::integer AS prev_pos
    FROM prev_ranking pr2
  )
  SELECT
    cr.user_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    cr.level,
    cr.reliability,
    cr.matches_played,
    public.get_player_category(cr.level::numeric, cr.tenant_id) AS category,
    cr.pos AS rank_position,
    pp.prev_pos AS prev_rank_position,
    public.get_player_streak(cr.user_id, _sport) AS streak,
    cr.last_match_at
  FROM current_ranking cr
  LEFT JOIN public.profiles p ON p.user_id = cr.user_id AND p.tenant_id = cr.tenant_id
  LEFT JOIN prev_with_pos pp ON pp.user_id = cr.user_id
  ORDER BY cr.pos ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_ranking(rating_sport) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_streak(uuid, rating_sport) TO authenticated;