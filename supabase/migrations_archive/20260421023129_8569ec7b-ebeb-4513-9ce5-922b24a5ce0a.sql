
-- Consolidated user profile summary function
-- Returns profile + rating + stats + recent matches + recent badges + sparkline
-- Honors privacy: hides email/phone unless owner, admin, or opt-in

CREATE OR REPLACE FUNCTION public.user_profile_summary(
  _user_id uuid,
  _sport public.rating_sport DEFAULT 'tenis_singles'::public.rating_sport
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _caller_tenant uuid := public.user_tenant_id(auth.uid());
  _profile RECORD;
  _rating RECORD;
  _category text;
  _ranking_position int;
  _ladder_position int;
  _ladder_status text;
  _wins int := 0;
  _losses int := 0;
  _walkovers_for int := 0;
  _walkovers_against int := 0;
  _streak int := 0;
  _streak_kind text := NULL;
  _best_level numeric := 0;
  _is_owner boolean;
  _is_admin boolean;
  _show_email boolean;
  _show_phone boolean;
  _recent_matches jsonb;
  _recent_badges jsonb;
  _sparkline jsonb;
  _result jsonb;
BEGIN
  -- Load profile (must be in same tenant)
  SELECT * INTO _profile FROM public.profiles WHERE user_id = _user_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Authorization: same tenant or super_admin
  IF NOT (_profile.tenant_id = _caller_tenant OR public.is_super_admin(_caller)) THEN
    RETURN NULL;
  END IF;

  _is_owner := (_caller = _user_id);
  _is_admin := public.is_club_admin_of(_caller, _profile.tenant_id) OR public.is_super_admin(_caller);
  _show_email := COALESCE(_profile.show_email, false) OR _is_owner OR _is_admin;
  _show_phone := COALESCE(_profile.show_phone, false) OR _is_owner OR _is_admin;

  -- Rating for the requested sport
  SELECT * INTO _rating
  FROM public.player_ratings
  WHERE user_id = _user_id AND sport = _sport
  ORDER BY matches_played DESC
  LIMIT 1;

  IF FOUND THEN
    SELECT public.get_player_category(_rating.level, _rating.tenant_id) INTO _category;
  END IF;

  -- Ranking position (consolidated only, reliability >= 30)
  IF _rating.level IS NOT NULL THEN
    SELECT COUNT(*) + 1 INTO _ranking_position
    FROM public.player_ratings pr
    WHERE pr.tenant_id = _profile.tenant_id
      AND pr.sport = _sport
      AND pr.reliability >= 30
      AND (pr.level > _rating.level OR (pr.level = _rating.level AND pr.matches_played > _rating.matches_played));
    -- If user himself isn't consolidated, return null
    IF _rating.reliability < 30 THEN
      _ranking_position := NULL;
    END IF;
  END IF;

  -- Ladder position (any active ladder where user is enrolled — pick first)
  SELECT lp.position, lp.status::text, lp.wins, lp.losses, lp.walkovers_for, lp.walkovers_against
    INTO _ladder_position, _ladder_status, _wins, _losses, _walkovers_for, _walkovers_against
  FROM public.ladder_positions lp
  JOIN public.ladders l ON l.id = lp.ladder_id
  WHERE lp.user_id = _user_id AND l.is_active = true
  ORDER BY lp.updated_at DESC
  LIMIT 1;

  -- Streak from ladder_history
  WITH events AS (
    SELECT reason, recorded_at
    FROM public.ladder_history
    WHERE user_id = _user_id
      AND reason IN ('desafio_ganado', 'desafio_perdido')
    ORDER BY recorded_at DESC
    LIMIT 30
  ), agg AS (
    SELECT
      reason,
      ROW_NUMBER() OVER (ORDER BY recorded_at DESC) AS rn,
      ROW_NUMBER() OVER (ORDER BY recorded_at DESC) -
        ROW_NUMBER() OVER (PARTITION BY reason ORDER BY recorded_at DESC) AS grp
    FROM events
  )
  SELECT
    COUNT(*)::int,
    MIN(reason)
  INTO _streak, _streak_kind
  FROM agg
  WHERE grp = 0 AND rn <= (SELECT MIN(rn) FROM agg WHERE grp != 0) - 1
     OR (grp = 0 AND NOT EXISTS (SELECT 1 FROM agg WHERE grp != 0));

  -- Fallback simpler streak if above is null
  IF _streak IS NULL OR _streak = 0 THEN
    SELECT COUNT(*)::int, MIN(reason)
    INTO _streak, _streak_kind
    FROM (
      SELECT reason FROM public.ladder_history
      WHERE user_id = _user_id AND reason IN ('desafio_ganado','desafio_perdido')
      ORDER BY recorded_at DESC LIMIT 1
    ) t;
  END IF;

  -- Best level historic
  SELECT COALESCE(MAX(level_after), _rating.level, 0) INTO _best_level
  FROM public.rating_history
  WHERE user_id = _user_id AND sport = _sport;

  -- Recent rating changes (last 5) with opponent name
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _recent_matches
  FROM (
    SELECT
      rh.id,
      rh.recorded_at,
      rh.delta,
      rh.level_after,
      rh.source::text AS source,
      rh.source_ref_id,
      CASE
        WHEN rh.source IN ('ladder_challenge','match_ladder') THEN
          (SELECT CASE WHEN c.challenger_user_id = _user_id THEN c.challenged_user_id
                       ELSE c.challenger_user_id END
           FROM public.ladder_challenges c WHERE c.id = rh.source_ref_id)
        WHEN rh.source IN ('tournament_match','match_tournament') THEN
          (SELECT
             CASE
               WHEN ra.player1_user_id = _user_id OR ra.player2_user_id = _user_id THEN
                 COALESCE(rb.player1_user_id, rb.player2_user_id)
               ELSE COALESCE(ra.player1_user_id, ra.player2_user_id)
             END
           FROM public.tournament_matches m
           LEFT JOIN public.tournament_registrations ra ON ra.id = m.registration_a_id
           LEFT JOIN public.tournament_registrations rb ON rb.id = m.registration_b_id
           WHERE m.id = rh.source_ref_id)
        ELSE NULL
      END AS opponent_id,
      (rh.delta > 0) AS won
    FROM public.rating_history rh
    WHERE rh.user_id = _user_id AND rh.sport = _sport
    ORDER BY rh.recorded_at DESC
    LIMIT 5
  ) t;

  -- Enrich opponent info
  WITH ops AS (
    SELECT (m->>'opponent_id')::uuid AS uid
    FROM jsonb_array_elements(_recent_matches) m
    WHERE m->>'opponent_id' IS NOT NULL
  )
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN m->>'opponent_id' IS NULL THEN m
      ELSE m || jsonb_build_object(
        'opponent_name', COALESCE(p.first_name || ' ' || p.last_name, 'Rival'),
        'opponent_avatar', p.avatar_url
      )
    END
  ), '[]'::jsonb) INTO _recent_matches
  FROM jsonb_array_elements(_recent_matches) m
  LEFT JOIN public.profiles p ON p.user_id = (m->>'opponent_id')::uuid;

  -- Recent badges (last 5)
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.awarded_at DESC), '[]'::jsonb) INTO _recent_badges
  FROM (
    SELECT ub.id, ub.awarded_at, b.code, b.name, b.description, b.icon, b.category::text
    FROM public.user_badges ub
    JOIN public.badges b ON b.id = ub.badge_id
    WHERE ub.user_id = _user_id
    ORDER BY ub.awarded_at DESC
    LIMIT 5
  ) t;

  -- Sparkline: last 10 level_after
  SELECT COALESCE(jsonb_agg(level_after ORDER BY recorded_at), '[]'::jsonb) INTO _sparkline
  FROM (
    SELECT level_after, recorded_at
    FROM public.rating_history
    WHERE user_id = _user_id AND sport = _sport
    ORDER BY recorded_at DESC
    LIMIT 10
  ) t;

  _result := jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', _profile.user_id,
      'first_name', _profile.first_name,
      'last_name', _profile.last_name,
      'avatar_url', _profile.avatar_url,
      'member_since', _profile.member_since,
      'bio', _profile.bio,
      'dominant_hand', _profile.dominant_hand,
      'backhand', _profile.backhand,
      'favorite_shot', _profile.favorite_shot,
      'favorite_surface', _profile.favorite_surface,
      'playing_style', _profile.playing_style,
      'availability', _profile.availability,
      'years_playing', _profile.years_playing,
      'email', CASE WHEN _show_email THEN _profile.email ELSE NULL END,
      'phone', CASE WHEN _show_phone THEN _profile.phone ELSE NULL END,
      'show_email', _profile.show_email,
      'show_phone', _profile.show_phone
    ),
    'rating', CASE WHEN _rating.id IS NULL THEN NULL ELSE jsonb_build_object(
      'sport', _rating.sport,
      'level', _rating.level,
      'reliability', _rating.reliability,
      'last_change_delta', _rating.last_change_delta,
      'matches_played', _rating.matches_played,
      'last_match_at', _rating.last_match_at,
      'category', _category,
      'best_level', _best_level
    ) END,
    'positions', jsonb_build_object(
      'ranking', _ranking_position,
      'ladder', _ladder_position,
      'ladder_status', _ladder_status
    ),
    'stats', jsonb_build_object(
      'wins', COALESCE(_wins, 0),
      'losses', COALESCE(_losses, 0),
      'walkovers_for', COALESCE(_walkovers_for, 0),
      'walkovers_against', COALESCE(_walkovers_against, 0),
      'streak', COALESCE(_streak, 0),
      'streak_kind', _streak_kind
    ),
    'recent_matches', COALESCE(_recent_matches, '[]'::jsonb),
    'recent_badges', COALESCE(_recent_badges, '[]'::jsonb),
    'sparkline', COALESCE(_sparkline, '[]'::jsonb),
    'flags', jsonb_build_object(
      'is_owner', _is_owner,
      'is_admin', _is_admin,
      'show_email', _show_email,
      'show_phone', _show_phone
    )
  );

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_profile_summary(uuid, public.rating_sport) TO authenticated;
