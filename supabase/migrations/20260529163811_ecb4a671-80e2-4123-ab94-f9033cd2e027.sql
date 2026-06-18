CREATE OR REPLACE FUNCTION public.user_profile_summary(_user_id uuid, _sport rating_sport DEFAULT 'tenis_singles'::rating_sport)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _caller_tenant uuid := public.user_tenant_id(auth.uid());
  _profile RECORD;
  _rating RECORD;
  _has_rating boolean := false;
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
  _ladder_discipline tournament_discipline;
  _last_reason text;
  _best_level numeric := 0;
  _is_owner boolean;
  _is_admin boolean;
  _show_email boolean;
  _show_phone boolean;
  _recent_matches jsonb := '[]'::jsonb;
  _recent_badges jsonb := '[]'::jsonb;
  _sparkline jsonb := '[]'::jsonb;
  _result jsonb;
BEGIN
  SELECT * INTO _profile FROM public.profiles WHERE user_id = _user_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT (_profile.tenant_id = _caller_tenant OR public.is_super_admin(_caller)) THEN
    RETURN NULL;
  END IF;

  _is_owner := (_caller = _user_id);
  _is_admin := public.is_club_admin_of(_caller, _profile.tenant_id) OR public.is_super_admin(_caller);
  _show_email := COALESCE(_profile.show_email, false) OR _is_owner OR _is_admin;
  _show_phone := COALESCE(_profile.show_phone, false) OR _is_owner OR _is_admin;

  SELECT * INTO _rating
  FROM public.player_ratings
  WHERE user_id = _user_id AND sport = _sport
  ORDER BY matches_played DESC
  LIMIT 1;
  _has_rating := FOUND;

  IF _has_rating THEN
    BEGIN
      SELECT public.get_player_category(_rating.level, _rating.tenant_id) INTO _category;
    EXCEPTION WHEN OTHERS THEN
      _category := NULL;
    END;

    SELECT COUNT(*) + 1 INTO _ranking_position
    FROM public.player_ratings pr
    WHERE pr.tenant_id = _profile.tenant_id
      AND pr.sport = _sport
      AND pr.reliability >= 30
      AND (pr.level > _rating.level OR (pr.level = _rating.level AND pr.matches_played > _rating.matches_played));
    IF _rating.reliability < 30 THEN
      _ranking_position := NULL;
    END IF;
  END IF;

  _ladder_discipline := CASE _sport WHEN 'tenis_singles' THEN 'tenis_singles'::tournament_discipline WHEN 'tenis_dobles' THEN 'tenis_dobles'::tournament_discipline WHEN 'padel' THEN 'padel_dobles'::tournament_discipline ELSE NULL END;

  SELECT lp.position, lp.status::text, lp.wins, lp.losses, lp.walkovers_for, lp.walkovers_against
    INTO _ladder_position, _ladder_status, _wins, _losses, _walkovers_for, _walkovers_against
  FROM public.ladder_positions lp
  JOIN public.ladders l ON l.id = lp.ladder_id
  WHERE lp.user_id = _user_id AND l.is_active = true AND (_ladder_discipline IS NULL OR l.discipline = _ladder_discipline)
  ORDER BY lp.updated_at DESC
  LIMIT 1;

  SELECT lh.reason::text INTO _last_reason
  FROM public.ladder_history lh JOIN public.ladders l ON l.id = lh.ladder_id
  WHERE lh.user_id = _user_id AND lh.reason IN ('desafio_ganado','desafio_perdido') AND (_ladder_discipline IS NULL OR l.discipline = _ladder_discipline)
  ORDER BY recorded_at DESC
  LIMIT 1;

  IF _last_reason IS NOT NULL THEN
    WITH ev AS (
      SELECT lh.reason::text AS r,
             row_number() OVER (ORDER BY lh.recorded_at DESC) AS rn
      FROM public.ladder_history lh JOIN public.ladders l ON l.id = lh.ladder_id
      WHERE lh.user_id = _user_id AND lh.reason IN ('desafio_ganado','desafio_perdido') AND (_ladder_discipline IS NULL OR l.discipline = _ladder_discipline)
      ORDER BY lh.recorded_at DESC
      LIMIT 30
    )
    SELECT COUNT(*) INTO _streak
    FROM ev
    WHERE r = _last_reason
      AND rn <= COALESCE((SELECT MIN(rn) FROM ev WHERE r <> _last_reason) - 1, 30);
    _streak_kind := _last_reason;
  END IF;

  SELECT COALESCE(MAX(level_after), COALESCE(_rating.level, 0)) INTO _best_level
  FROM public.rating_history
  WHERE user_id = _user_id AND sport = _sport;

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
        WHEN rh.source::text = 'ladder_challenge' THEN
          (SELECT CASE WHEN c.challenger_user_id = _user_id THEN c.challenged_user_id
                       ELSE c.challenger_user_id END
           FROM public.ladder_challenges c WHERE c.id = rh.source_ref_id)
        WHEN rh.source::text = 'tournament_match' THEN
          (SELECT
             CASE
               WHEN ra.player1_user_id = _user_id OR ra.player2_user_id = _user_id THEN
                 COALESCE(NULLIF(rb.player1_user_id, _user_id), rb.player2_user_id)
               ELSE COALESCE(NULLIF(ra.player1_user_id, _user_id), ra.player2_user_id)
             END
           FROM public.tournament_matches m
           LEFT JOIN public.tournament_registrations ra ON ra.id = m.registration_a_id
           LEFT JOIN public.tournament_registrations rb ON rb.id = m.registration_b_id
           WHERE m.id = rh.source_ref_id)
        ELSE NULL
      END AS opponent_id,
      CASE
        WHEN rh.source::text = 'ladder_challenge' THEN
          (SELECT public.format_score_summary(c.score)
           FROM public.ladder_challenges c WHERE c.id = rh.source_ref_id)
        WHEN rh.source::text = 'tournament_match' THEN
          (SELECT public.format_score_summary(m.score)
           FROM public.tournament_matches m WHERE m.id = rh.source_ref_id)
        ELSE NULL
      END AS score_summary,
      CASE
        WHEN rh.source::text = 'tournament_match' THEN
          (SELECT
             CASE
               WHEN ra.player1_user_id = _user_id THEN
                 (SELECT first_name || ' ' || last_name FROM public.profiles WHERE user_id = ra.player2_user_id)
               WHEN ra.player2_user_id = _user_id THEN
                 (SELECT first_name || ' ' || last_name FROM public.profiles WHERE user_id = ra.player1_user_id)
               WHEN rb.player1_user_id = _user_id THEN
                 (SELECT first_name || ' ' || last_name FROM public.profiles WHERE user_id = rb.player2_user_id)
               WHEN rb.player2_user_id = _user_id THEN
                 (SELECT first_name || ' ' || last_name FROM public.profiles WHERE user_id = rb.player1_user_id)
               ELSE NULL
             END
           FROM public.tournament_matches m
           LEFT JOIN public.tournament_registrations ra ON ra.id = m.registration_a_id
           LEFT JOIN public.tournament_registrations rb ON rb.id = m.registration_b_id
           WHERE m.id = rh.source_ref_id)
        ELSE NULL
      END AS partner_name,
      (rh.delta > 0) AS won
    FROM public.rating_history rh
    WHERE rh.user_id = _user_id AND rh.sport = _sport
    ORDER BY rh.recorded_at DESC
    LIMIT 10
  ) t;

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
  LEFT JOIN public.profiles p ON p.user_id = NULLIF(m->>'opponent_id','')::uuid;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.awarded_at DESC), '[]'::jsonb) INTO _recent_badges
  FROM (
    SELECT ub.id, ub.awarded_at, b.code, b.name, b.description, b.icon, b.category::text
    FROM public.user_badges ub
    JOIN public.badges b ON b.id = ub.badge_id
    WHERE ub.user_id = _user_id
    ORDER BY ub.awarded_at DESC
    LIMIT 5
  ) t;

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
    'rating', CASE WHEN NOT _has_rating THEN NULL ELSE jsonb_build_object(
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
$function$;