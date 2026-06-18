CREATE OR REPLACE FUNCTION public.analytics_overview(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
  SELECT COALESCE(SUM(
    GREATEST(EXTRACT(EPOCH FROM (p_to - p_from)) / 86400.0, 1)
    * EXTRACT(EPOCH FROM (c.closes_at - c.opens_at))
  ), 0)
  INTO v_total_slot_seconds
  FROM public.courts c
  WHERE c.tenant_id = v_tenant AND c.is_active = true;

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (b.ends_at - b.starts_at))), 0)
  INTO v_booked_seconds
  FROM public.bookings b
  WHERE b.tenant_id = v_tenant AND b.status = 'confirmada'
    AND b.starts_at >= p_from AND b.starts_at < p_to;

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (b.ends_at - b.starts_at))), 0)
  INTO v_prev_booked_seconds
  FROM public.bookings b
  WHERE b.tenant_id = v_tenant AND b.status = 'confirmada'
    AND b.starts_at >= v_prev_from AND b.starts_at < v_prev_to;

  v_occupancy_pct := CASE WHEN v_total_slot_seconds > 0
    THEN ROUND((v_booked_seconds / v_total_slot_seconds * 100)::numeric, 1) ELSE 0 END;
  v_prev_occupancy_pct := CASE WHEN v_total_slot_seconds > 0
    THEN ROUND((v_prev_booked_seconds / v_total_slot_seconds * 100)::numeric, 1) ELSE 0 END;

  WITH active AS (
    SELECT user_id FROM public.bookings WHERE tenant_id = v_tenant AND starts_at >= now() - interval '30 days'
    UNION SELECT challenger_user_id FROM public.ladder_challenges WHERE tenant_id = v_tenant AND created_at >= now() - interval '30 days'
    UNION SELECT challenged_user_id FROM public.ladder_challenges WHERE tenant_id = v_tenant AND created_at >= now() - interval '30 days'
    UNION SELECT student1_user_id FROM public.coach_class_bookings WHERE tenant_id = v_tenant AND starts_at >= now() - interval '30 days' AND student1_user_id IS NOT NULL
  )
  SELECT COUNT(DISTINCT user_id) INTO v_active_members FROM active WHERE user_id IS NOT NULL;

  SELECT COUNT(*) INTO v_inactive_members FROM public.profiles p
  WHERE p.tenant_id = v_tenant AND NOT EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.user_id = p.user_id AND b.starts_at >= now() - interval '30 days'
  );

  SELECT COUNT(*) INTO v_morosos FROM public.profiles p
  WHERE p.tenant_id = v_tenant AND p.dues_status = 'moroso';

  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public.tournaments WHERE tenant_id = $1 AND status IN (''inscripciones_abiertas'',''inscripciones_cerradas'',''en_curso'')'
      INTO v_active_tournaments USING v_tenant;
  EXCEPTION WHEN undefined_table THEN v_active_tournaments := 0;
  END;

  SELECT COUNT(*) INTO v_active_challenges FROM public.ladder_challenges
  WHERE tenant_id = v_tenant AND status IN ('propuesto','aceptado','agendado');

  BEGIN
    SELECT
      (SELECT COUNT(*) FROM public.ladder_challenges
         WHERE tenant_id = v_tenant AND played_at >= now() - interval '7 days' AND status = 'jugado')
      +
      (SELECT COUNT(*) FROM public.tournament_matches
         WHERE tenant_id = v_tenant AND played_at >= now() - interval '7 days' AND status = 'jugado')
    INTO v_matches_week;
  EXCEPTION WHEN undefined_table THEN
    SELECT COUNT(*) INTO v_matches_week FROM public.ladder_challenges
      WHERE tenant_id = v_tenant AND played_at >= now() - interval '7 days' AND status = 'jugado';
  END;

  SELECT COALESCE(SUM(price_clp), 0) INTO v_clases_revenue
  FROM public.coach_class_bookings
  WHERE tenant_id = v_tenant AND payment_status = 'pagado'
    AND starts_at >= p_from AND starts_at < p_to;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_top_coaches FROM (
    SELECT cp.id, COALESCE(p.first_name || ' ' || p.last_name, 'Coach') as name,
           COUNT(ccb.id)::int as classes,
           COALESCE(SUM(ccb.price_clp) FILTER (WHERE ccb.payment_status = 'pagado'), 0)::bigint as revenue
    FROM public.coach_class_bookings ccb
    JOIN public.coach_profiles cp ON cp.id = ccb.coach_id
    LEFT JOIN public.profiles p ON p.user_id = cp.user_id
    WHERE ccb.tenant_id = v_tenant AND ccb.starts_at >= p_from AND ccb.starts_at < p_to
    GROUP BY cp.id, p.first_name, p.last_name
    ORDER BY classes DESC LIMIT 5
  ) t;

  v_health_score := GREATEST(0, LEAST(100,
    50 + COALESCE(v_occupancy_pct, 0)::int / 2
       - COALESCE(v_morosos, 0) * 3
       + LEAST(20, COALESCE(v_active_members, 0))
  ));

  RETURN jsonb_build_object(
    'occupancy_pct', v_occupancy_pct,
    'prev_occupancy_pct', v_prev_occupancy_pct,
    'occupancy_delta_pp', ROUND((v_occupancy_pct - v_prev_occupancy_pct)::numeric, 1),
    'active_members_30d', v_active_members,
    'inactive_members_30d', v_inactive_members,
    'morosos', v_morosos,
    'active_tournaments', v_active_tournaments,
    'active_challenges', v_active_challenges,
    'matches_played_week', v_matches_week,
    'clases_revenue_clp', v_clases_revenue,
    'top_coaches', v_top_coaches,
    'health_score', v_health_score
  );
END;
$function$;