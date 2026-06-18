
-- Fase 6: Analytics por deporte
-- Agrega parámetro p_sport ('todos'|'tenis'|'padel') a los RPCs principales.
-- Filtra bookings/classes vía courts.sport, ladders/ratings vía discipline/sport enum,
-- y coaches vía coach_profiles.sports.

DROP FUNCTION IF EXISTS public.analytics_overview(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.analytics_occupancy_heatmap(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.analytics_finance_summary(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.analytics_coaches_performance(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.analytics_community_stats(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.analytics_members_engagement(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.analytics_directory_digest(date);

-- ============ OVERVIEW ============
CREATE FUNCTION public.analytics_overview(
  p_from timestamptz, p_to timestamptz, p_sport text DEFAULT 'todos'
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public._analytics_guard();
  v_prev_from timestamptz := p_from - (p_to - p_from);
  v_prev_to timestamptz := p_from;
  v_total_slot_seconds numeric;
  v_booked_seconds numeric;
  v_prev_booked_seconds numeric;
  v_occupancy_pct numeric;
  v_prev_occupancy_pct numeric;
  v_active_members integer;
  v_inactive_members integer;
  v_morosos integer;
  v_active_tournaments integer;
  v_active_challenges integer;
  v_matches_week integer;
  v_clases_revenue bigint;
  v_top_coaches jsonb;
  v_health_score integer;
BEGIN
  SELECT COALESCE(SUM(GREATEST(EXTRACT(EPOCH FROM (p_to - p_from)) / 86400.0, 1) * EXTRACT(EPOCH FROM (c.closes_at - c.opens_at))), 0)
  INTO v_total_slot_seconds FROM public.courts c
  WHERE c.tenant_id = v_tenant AND c.is_active = true
    AND (p_sport = 'todos' OR c.sport = p_sport);

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (b.ends_at - b.starts_at))), 0) INTO v_booked_seconds
  FROM public.bookings b
  JOIN public.courts c ON c.id = b.court_id
  WHERE b.tenant_id = v_tenant AND b.status = 'confirmada'
    AND b.starts_at >= p_from AND b.starts_at < p_to
    AND (p_sport = 'todos' OR c.sport = p_sport);

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (b.ends_at - b.starts_at))), 0) INTO v_prev_booked_seconds
  FROM public.bookings b
  JOIN public.courts c ON c.id = b.court_id
  WHERE b.tenant_id = v_tenant AND b.status = 'confirmada'
    AND b.starts_at >= v_prev_from AND b.starts_at < v_prev_to
    AND (p_sport = 'todos' OR c.sport = p_sport);

  v_occupancy_pct := CASE WHEN v_total_slot_seconds > 0 THEN ROUND((v_booked_seconds / v_total_slot_seconds * 100)::numeric, 1) ELSE 0 END;
  v_prev_occupancy_pct := CASE WHEN v_total_slot_seconds > 0 THEN ROUND((v_prev_booked_seconds / v_total_slot_seconds * 100)::numeric, 1) ELSE 0 END;

  WITH active AS (
    SELECT b.user_id FROM public.bookings b
    JOIN public.courts c ON c.id = b.court_id
    WHERE b.tenant_id = v_tenant AND b.starts_at >= now() - interval '30 days'
      AND (p_sport = 'todos' OR c.sport = p_sport)
    UNION
    SELECT lc.challenger_user_id FROM public.ladder_challenges lc
    JOIN public.ladders l ON l.id = lc.ladder_id
    WHERE lc.tenant_id = v_tenant AND lc.created_at >= now() - interval '30 days'
      AND (p_sport = 'todos'
           OR (p_sport = 'tenis' AND l.discipline IN ('tenis_singles','tenis_dobles'))
           OR (p_sport = 'padel' AND l.discipline = 'padel_dobles'))
    UNION
    SELECT lc.challenged_user_id FROM public.ladder_challenges lc
    JOIN public.ladders l ON l.id = lc.ladder_id
    WHERE lc.tenant_id = v_tenant AND lc.created_at >= now() - interval '30 days'
      AND (p_sport = 'todos'
           OR (p_sport = 'tenis' AND l.discipline IN ('tenis_singles','tenis_dobles'))
           OR (p_sport = 'padel' AND l.discipline = 'padel_dobles'))
    UNION
    SELECT ccb.student1_user_id FROM public.coach_class_bookings ccb
    JOIN public.courts c ON c.id = ccb.court_id
    WHERE ccb.tenant_id = v_tenant AND ccb.starts_at >= now() - interval '30 days'
      AND ccb.student1_user_id IS NOT NULL
      AND (p_sport = 'todos' OR c.sport = p_sport)
  )
  SELECT COUNT(DISTINCT user_id) INTO v_active_members FROM active WHERE user_id IS NOT NULL;

  SELECT COUNT(*) INTO v_inactive_members FROM public.profiles p
  WHERE p.tenant_id = v_tenant
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.courts c ON c.id = b.court_id
      WHERE b.user_id = p.user_id AND b.starts_at >= now() - interval '30 days'
        AND (p_sport = 'todos' OR c.sport = p_sport)
    );

  SELECT COUNT(*) INTO v_morosos FROM public.profiles p WHERE p.tenant_id = v_tenant AND p.dues_status = 'moroso';

  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public.tournaments WHERE tenant_id = $1 AND status IN (''inscripciones_abiertas'',''inscripciones_cerradas'',''en_curso'')'
      INTO v_active_tournaments USING v_tenant;
  EXCEPTION WHEN undefined_table THEN v_active_tournaments := 0;
  END;

  SELECT COUNT(*) INTO v_active_challenges FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.tenant_id = v_tenant AND lc.status IN ('propuesto','aceptado','programado')
    AND (p_sport = 'todos'
         OR (p_sport = 'tenis' AND l.discipline IN ('tenis_singles','tenis_dobles'))
         OR (p_sport = 'padel' AND l.discipline = 'padel_dobles'));

  BEGIN
    SELECT
      (SELECT COUNT(*) FROM public.ladder_challenges lc
        JOIN public.ladders l ON l.id = lc.ladder_id
        WHERE lc.tenant_id = v_tenant AND lc.played_at >= now() - interval '7 days' AND lc.status = 'jugado'
          AND (p_sport = 'todos'
               OR (p_sport = 'tenis' AND l.discipline IN ('tenis_singles','tenis_dobles'))
               OR (p_sport = 'padel' AND l.discipline = 'padel_dobles')))
      + (SELECT COUNT(*) FROM public.tournament_matches WHERE tenant_id = v_tenant AND played_at >= now() - interval '7 days' AND status = 'jugado')
    INTO v_matches_week;
  EXCEPTION WHEN undefined_table THEN
    SELECT COUNT(*) INTO v_matches_week FROM public.ladder_challenges lc
      JOIN public.ladders l ON l.id = lc.ladder_id
      WHERE lc.tenant_id = v_tenant AND lc.played_at >= now() - interval '7 days' AND lc.status = 'jugado'
        AND (p_sport = 'todos'
             OR (p_sport = 'tenis' AND l.discipline IN ('tenis_singles','tenis_dobles'))
             OR (p_sport = 'padel' AND l.discipline = 'padel_dobles'));
  END;

  SELECT COALESCE(SUM(ccb.price_clp), 0) INTO v_clases_revenue FROM public.coach_class_bookings ccb
  JOIN public.courts c ON c.id = ccb.court_id
  WHERE ccb.tenant_id = v_tenant AND ccb.payment_status = 'pagada'
    AND ccb.starts_at >= p_from AND ccb.starts_at < p_to
    AND (p_sport = 'todos' OR c.sport = p_sport);

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_top_coaches FROM (
    SELECT cp.id, COALESCE(pr.first_name || ' ' || pr.last_name, 'Coach') as name,
           COUNT(ccb.id)::int as classes,
           COALESCE(SUM(ccb.price_clp) FILTER (WHERE ccb.payment_status = 'pagada'), 0)::bigint as revenue
    FROM public.coach_class_bookings ccb
    JOIN public.coach_profiles cp ON cp.id = ccb.coach_id
    JOIN public.courts c ON c.id = ccb.court_id
    LEFT JOIN public.profiles pr ON pr.user_id = cp.user_id
    WHERE ccb.tenant_id = v_tenant AND ccb.starts_at >= p_from AND ccb.starts_at < p_to
      AND (p_sport = 'todos' OR c.sport = p_sport)
      AND (p_sport = 'todos' OR p_sport = ANY(cp.sports))
    GROUP BY cp.id, pr.first_name, pr.last_name ORDER BY classes DESC LIMIT 5
  ) t;

  v_health_score := GREATEST(0, LEAST(100,
    50 + COALESCE(v_occupancy_pct, 0)::int / 2 - COALESCE(v_morosos, 0) * 3 + LEAST(20, COALESCE(v_active_members, 0))));

  RETURN jsonb_build_object(
    'occupancy_pct', v_occupancy_pct, 'prev_occupancy_pct', v_prev_occupancy_pct,
    'occupancy_delta_pp', ROUND((v_occupancy_pct - v_prev_occupancy_pct)::numeric, 1),
    'active_members_30d', v_active_members, 'inactive_members_30d', v_inactive_members,
    'morosos', v_morosos, 'active_tournaments', v_active_tournaments,
    'active_challenges', v_active_challenges, 'matches_played_week', v_matches_week,
    'clases_revenue_clp', v_clases_revenue, 'top_coaches', v_top_coaches,
    'health_score', v_health_score, 'sport', p_sport
  );
END;
$function$;

-- ============ OCCUPANCY HEATMAP ============
CREATE FUNCTION public.analytics_occupancy_heatmap(
  p_from timestamptz, p_to timestamptz, p_sport text DEFAULT 'todos'
)
RETURNS TABLE(weekday integer, hour integer, court_id uuid, court_name text, occupied_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_tenant uuid := public._analytics_guard();
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(ISODOW FROM b.starts_at)::int AS weekday,
    EXTRACT(HOUR FROM b.starts_at)::int AS hour,
    b.court_id,
    c.name AS court_name,
    COUNT(*)::bigint AS occupied_count
  FROM public.bookings b
  JOIN public.courts c ON c.id = b.court_id
  WHERE b.tenant_id = v_tenant AND b.status = 'confirmada'
    AND b.starts_at >= p_from AND b.starts_at < p_to
    AND (p_sport = 'todos' OR c.sport = p_sport)
  GROUP BY 1, 2, 3, 4 ORDER BY 1, 2;
END;
$function$;

-- ============ FINANCE SUMMARY ============
CREATE FUNCTION public.analytics_finance_summary(
  p_from timestamptz, p_to timestamptz, p_sport text DEFAULT 'todos'
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public._analytics_guard();
  v_clases bigint;
  v_morosos_total integer;
  v_revenue_by_day jsonb;
BEGIN
  SELECT COALESCE(SUM(ccb.price_clp), 0)::bigint INTO v_clases
  FROM public.coach_class_bookings ccb
  JOIN public.courts c ON c.id = ccb.court_id
  WHERE ccb.tenant_id = v_tenant AND ccb.payment_status = 'pagada'
    AND ccb.paid_at >= p_from AND ccb.paid_at < p_to
    AND (p_sport = 'todos' OR c.sport = p_sport);

  SELECT COUNT(*) INTO v_morosos_total
  FROM public.profiles WHERE tenant_id = v_tenant AND dues_status = 'moroso';

  SELECT COALESCE(jsonb_agg(t ORDER BY t->>'day'), '[]'::jsonb) INTO v_revenue_by_day FROM (
    SELECT jsonb_build_object(
      'day', date_trunc('day', ccb.paid_at)::date,
      'clases', COALESCE(SUM(ccb.price_clp), 0)::bigint
    ) AS t
    FROM public.coach_class_bookings ccb
    JOIN public.courts c ON c.id = ccb.court_id
    WHERE ccb.tenant_id = v_tenant AND ccb.payment_status = 'pagada'
      AND ccb.paid_at >= p_from AND ccb.paid_at < p_to
      AND (p_sport = 'todos' OR c.sport = p_sport)
    GROUP BY date_trunc('day', ccb.paid_at)
  ) sub;

  RETURN jsonb_build_object(
    'clases_revenue_clp', v_clases,
    'cuotas_revenue_clp', NULL, 'reservas_revenue_clp', NULL, 'torneos_revenue_clp', NULL,
    'morosos_total', v_morosos_total,
    'morosos_30d', v_morosos_total, 'morosos_60d', 0, 'morosos_90d', 0,
    'revenue_by_day', v_revenue_by_day, 'sport', p_sport
  );
END;
$function$;

-- ============ COACHES PERFORMANCE ============
CREATE FUNCTION public.analytics_coaches_performance(
  p_from timestamptz, p_to timestamptz, p_sport text DEFAULT 'todos'
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public._analytics_guard();
  v_coaches jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'classes')::int DESC), '[]'::jsonb) INTO v_coaches FROM (
    SELECT jsonb_build_object(
      'coach_id', cp.id,
      'name', COALESCE(pr.first_name || ' ' || pr.last_name, 'Coach'),
      'classes', COUNT(ccb.id)::int,
      'revenue_clp', COALESCE(SUM(ccb.price_clp), 0)::bigint,
      'avg_ticket_clp', CASE WHEN COUNT(ccb.id) > 0
        THEN (SUM(ccb.price_clp) / COUNT(ccb.id))::int ELSE 0 END,
      'cancelled', COUNT(ccb.id) FILTER (WHERE ccb.status = 'cancelada')::int,
      'sports', cp.sports
    ) AS t
    FROM public.coach_profiles cp
    LEFT JOIN public.profiles pr ON pr.user_id = cp.user_id AND pr.tenant_id = v_tenant
    LEFT JOIN public.coach_class_bookings ccb
      ON ccb.coach_id = cp.id
     AND ccb.starts_at >= p_from AND ccb.starts_at < p_to
     AND (p_sport = 'todos' OR EXISTS (
       SELECT 1 FROM public.courts c WHERE c.id = ccb.court_id AND c.sport = p_sport
     ))
    WHERE cp.tenant_id = v_tenant AND cp.is_active = true
      AND (p_sport = 'todos' OR p_sport = ANY(cp.sports))
    GROUP BY cp.id, pr.first_name, pr.last_name, cp.sports
  ) sub;

  RETURN jsonb_build_object('coaches', v_coaches, 'sport', p_sport);
END;
$function$;

-- ============ COMMUNITY STATS ============
CREATE FUNCTION public.analytics_community_stats(
  p_from timestamptz, p_to timestamptz, p_sport text DEFAULT 'todos'
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public._analytics_guard();
  v_avg_accept_hours numeric;
  v_avg_play_hours numeric;
  v_active_ladders jsonb;
  v_progress jsonb;
  v_decline jsonb;
  v_level_density jsonb;
BEGIN
  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (lc.responded_at - lc.proposed_at))/3600.0), 0)::numeric
  INTO v_avg_accept_hours
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.tenant_id = v_tenant
    AND lc.responded_at IS NOT NULL
    AND lc.proposed_at >= p_from AND lc.proposed_at < p_to
    AND (p_sport = 'todos'
         OR (p_sport = 'tenis' AND l.discipline IN ('tenis_singles','tenis_dobles'))
         OR (p_sport = 'padel' AND l.discipline = 'padel_dobles'));

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (lc.played_at - lc.responded_at))/3600.0), 0)::numeric
  INTO v_avg_play_hours
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.tenant_id = v_tenant
    AND lc.played_at IS NOT NULL AND lc.responded_at IS NOT NULL
    AND lc.proposed_at >= p_from AND lc.proposed_at < p_to
    AND (p_sport = 'todos'
         OR (p_sport = 'tenis' AND l.discipline IN ('tenis_singles','tenis_dobles'))
         OR (p_sport = 'padel' AND l.discipline = 'padel_dobles'));

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'matches')::int DESC), '[]'::jsonb) INTO v_active_ladders FROM (
    SELECT jsonb_build_object(
      'ladder_id', l.id, 'name', l.name,
      'matches', COUNT(c.id)::int
    ) AS t
    FROM public.ladders l
    LEFT JOIN public.ladder_challenges c
      ON c.ladder_id = l.id AND c.played_at >= p_from AND c.played_at < p_to
    WHERE l.tenant_id = v_tenant AND l.is_active = true
      AND (p_sport = 'todos'
           OR (p_sport = 'tenis' AND l.discipline IN ('tenis_singles','tenis_dobles'))
           OR (p_sport = 'padel' AND l.discipline = 'padel_dobles'))
    GROUP BY l.id, l.name
  ) sub;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'delta')::numeric DESC), '[]'::jsonb) INTO v_progress FROM (
    SELECT jsonb_build_object(
      'user_id', p.user_id,
      'name', p.first_name || ' ' || p.last_name,
      'delta', ROUND(SUM(rh.delta)::numeric, 2)
    ) AS t
    FROM public.rating_history rh
    JOIN public.profiles p ON p.user_id = rh.user_id AND p.tenant_id = v_tenant
    WHERE rh.tenant_id = v_tenant
      AND rh.recorded_at >= p_from AND rh.recorded_at < p_to
      AND (p_sport = 'todos'
           OR (p_sport = 'tenis' AND rh.sport IN ('tenis_singles','tenis_dobles'))
           OR (p_sport = 'padel' AND rh.sport = 'padel_dobles'))
    GROUP BY p.user_id, p.first_name, p.last_name
    HAVING SUM(rh.delta) > 0
    ORDER BY SUM(rh.delta) DESC LIMIT 5
  ) sub;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'delta')::numeric ASC), '[]'::jsonb) INTO v_decline FROM (
    SELECT jsonb_build_object(
      'user_id', p.user_id,
      'name', p.first_name || ' ' || p.last_name,
      'delta', ROUND(SUM(rh.delta)::numeric, 2)
    ) AS t
    FROM public.rating_history rh
    JOIN public.profiles p ON p.user_id = rh.user_id AND p.tenant_id = v_tenant
    WHERE rh.tenant_id = v_tenant
      AND rh.recorded_at >= p_from AND rh.recorded_at < p_to
      AND (p_sport = 'todos'
           OR (p_sport = 'tenis' AND rh.sport IN ('tenis_singles','tenis_dobles'))
           OR (p_sport = 'padel' AND rh.sport = 'padel_dobles'))
    GROUP BY p.user_id, p.first_name, p.last_name
    HAVING SUM(rh.delta) < 0
    ORDER BY SUM(rh.delta) ASC LIMIT 5
  ) sub;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'bucket')::numeric), '[]'::jsonb) INTO v_level_density FROM (
    SELECT jsonb_build_object(
      'bucket', FLOOR(level * 2) / 2.0,
      'count', COUNT(*)
    ) AS t
    FROM public.player_ratings
    WHERE tenant_id = v_tenant
      AND (p_sport = 'todos'
           OR (p_sport = 'tenis' AND sport IN ('tenis_singles','tenis_dobles'))
           OR (p_sport = 'padel' AND sport = 'padel_dobles'))
    GROUP BY FLOOR(level * 2) / 2.0
  ) sub;

  RETURN jsonb_build_object(
    'avg_accept_hours', ROUND(v_avg_accept_hours, 1),
    'avg_play_hours', ROUND(v_avg_play_hours, 1),
    'active_ladders', v_active_ladders,
    'top_progress', v_progress,
    'top_decline', v_decline,
    'level_density', v_level_density,
    'sport', p_sport
  );
END;
$function$;

-- ============ MEMBERS ENGAGEMENT ============
CREATE FUNCTION public.analytics_members_engagement(
  p_from timestamptz, p_to timestamptz, p_sport text DEFAULT 'todos'
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public._analytics_guard();
  v_total_members integer;
  v_avg_bookings numeric;
  v_distribution jsonb;
  v_at_risk jsonb;
  v_stars jsonb;
  v_funnel jsonb;
BEGIN
  SELECT COUNT(*) INTO v_total_members FROM public.profiles WHERE tenant_id = v_tenant;

  SELECT COALESCE(AVG(cnt), 0)::numeric INTO v_avg_bookings FROM (
    SELECT b.user_id, COUNT(*) AS cnt
    FROM public.bookings b
    JOIN public.courts c ON c.id = b.court_id
    WHERE b.tenant_id = v_tenant AND b.starts_at >= p_from AND b.starts_at < p_to
      AND (p_sport = 'todos' OR c.sport = p_sport)
    GROUP BY b.user_id
  ) s;

  SELECT jsonb_build_object(
    'C', COUNT(*) FILTER (WHERE pr.level <= COALESCE(trc.category_c_max, 2.5)),
    'B', COUNT(*) FILTER (WHERE pr.level > COALESCE(trc.category_c_max, 2.5) AND pr.level <= COALESCE(trc.category_b_max, 4.0)),
    'A', COUNT(*) FILTER (WHERE pr.level > COALESCE(trc.category_b_max, 4.0)),
    'sin_rating', (SELECT COUNT(*) FROM public.profiles p
                    WHERE p.tenant_id = v_tenant
                    AND NOT EXISTS (
                      SELECT 1 FROM public.player_ratings pr2
                      WHERE pr2.user_id = p.user_id AND pr2.tenant_id = v_tenant
                        AND (p_sport = 'todos'
                             OR (p_sport = 'tenis' AND pr2.sport IN ('tenis_singles','tenis_dobles'))
                             OR (p_sport = 'padel' AND pr2.sport = 'padel_dobles'))
                    ))
  ) INTO v_distribution
  FROM public.player_ratings pr
  LEFT JOIN public.tenant_rating_config trc ON trc.tenant_id = v_tenant
  WHERE pr.tenant_id = v_tenant
    AND (p_sport = 'todos'
         OR (p_sport = 'tenis' AND pr.sport IN ('tenis_singles','tenis_dobles'))
         OR (p_sport = 'padel' AND pr.sport = 'padel_dobles'));

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_at_risk FROM (
    SELECT
      p.user_id,
      p.first_name || ' ' || p.last_name AS name,
      p.member_since,
      (SELECT MAX(b.starts_at) FROM public.bookings b
        JOIN public.courts c ON c.id = b.court_id
        WHERE b.user_id = p.user_id
          AND (p_sport = 'todos' OR c.sport = p_sport)) AS last_activity
    FROM public.profiles p
    WHERE p.tenant_id = v_tenant
      AND NOT EXISTS (
        SELECT 1 FROM public.bookings b
        JOIN public.courts c ON c.id = b.court_id
        WHERE b.user_id = p.user_id AND b.starts_at >= now() - interval '60 days'
          AND (p_sport = 'todos' OR c.sport = p_sport)
      )
    ORDER BY p.member_since ASC LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_stars FROM (
    SELECT
      p.user_id,
      p.first_name || ' ' || p.last_name AS name,
      COUNT(b.id) AS bookings_count
    FROM public.profiles p
    JOIN public.bookings b ON b.user_id = p.user_id AND b.tenant_id = v_tenant
    JOIN public.courts c ON c.id = b.court_id
    WHERE p.tenant_id = v_tenant
      AND b.starts_at >= p_from AND b.starts_at < p_to
      AND (p_sport = 'todos' OR c.sport = p_sport)
    GROUP BY p.user_id, p.first_name, p.last_name
    ORDER BY bookings_count DESC LIMIT 10
  ) t;

  SELECT jsonb_build_object(
    'enviados', COUNT(*),
    'aceptados', COUNT(*) FILTER (WHERE lc.status IN ('aceptado','programado','jugado')),
    'jugados', COUNT(*) FILTER (WHERE lc.status = 'jugado')
  ) INTO v_funnel
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.tenant_id = v_tenant
    AND lc.created_at >= p_from AND lc.created_at < p_to
    AND (p_sport = 'todos'
         OR (p_sport = 'tenis' AND l.discipline IN ('tenis_singles','tenis_dobles'))
         OR (p_sport = 'padel' AND l.discipline = 'padel_dobles'));

  RETURN jsonb_build_object(
    'total_members', v_total_members,
    'avg_bookings_per_member', ROUND(v_avg_bookings, 1),
    'distribution', v_distribution,
    'at_risk', v_at_risk, 'stars', v_stars,
    'challenge_funnel', v_funnel,
    'sport', p_sport
  );
END;
$function$;

-- ============ DIRECTORY DIGEST ============
CREATE FUNCTION public.analytics_directory_digest(
  p_month date, p_sport text DEFAULT 'todos'
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := public._analytics_guard();
  v_from timestamptz := date_trunc('month', p_month);
  v_to timestamptz := (date_trunc('month', p_month) + interval '1 month');
  v_overview jsonb;
  v_finance jsonb;
  v_engagement jsonb;
BEGIN
  v_overview := public.analytics_overview(v_from, v_to, p_sport);
  v_finance := public.analytics_finance_summary(v_from, v_to, p_sport);
  v_engagement := public.analytics_members_engagement(v_from, v_to, p_sport);

  RETURN jsonb_build_object(
    'month', p_month, 'sport', p_sport,
    'overview', v_overview, 'finance', v_finance, 'engagement', v_engagement,
    'wins', jsonb_build_array(
      'Ocupación: ' || (v_overview->>'occupancy_pct') || '%',
      'Socios activos: ' || (v_overview->>'active_members_30d'),
      'Partidos jugados: ' || (v_overview->>'matches_played_week')
    ),
    'risks', jsonb_build_array(
      'Morosos: ' || (v_overview->>'morosos'),
      'Inactivos: ' || (v_overview->>'inactive_members_30d')
    )
  );
END;
$function$;
