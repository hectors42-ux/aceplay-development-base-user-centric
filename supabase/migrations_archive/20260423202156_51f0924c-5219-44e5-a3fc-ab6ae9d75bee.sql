CREATE OR REPLACE FUNCTION public.analytics_members_engagement(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    SELECT user_id, COUNT(*) AS cnt
    FROM public.bookings
    WHERE tenant_id = v_tenant AND starts_at >= p_from AND starts_at < p_to
    GROUP BY user_id
  ) s;

  -- Distribución por categoría según rating
  SELECT jsonb_build_object(
    'C', COUNT(*) FILTER (WHERE pr.level <= COALESCE(trc.category_c_max, 2.5)),
    'B', COUNT(*) FILTER (WHERE pr.level > COALESCE(trc.category_c_max, 2.5) AND pr.level <= COALESCE(trc.category_b_max, 4.0)),
    'A', COUNT(*) FILTER (WHERE pr.level > COALESCE(trc.category_b_max, 4.0)),
    'sin_rating', (SELECT COUNT(*) FROM public.profiles p
                    WHERE p.tenant_id = v_tenant
                    AND NOT EXISTS (SELECT 1 FROM public.player_ratings pr2 WHERE pr2.user_id = p.user_id AND pr2.tenant_id = v_tenant))
  ) INTO v_distribution
  FROM public.player_ratings pr
  LEFT JOIN public.tenant_rating_config trc ON trc.tenant_id = v_tenant
  WHERE pr.tenant_id = v_tenant;

  -- Socios en riesgo (sin actividad 60d)
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_at_risk FROM (
    SELECT
      p.user_id,
      p.first_name || ' ' || p.last_name AS name,
      p.member_since,
      (SELECT MAX(starts_at) FROM public.bookings b WHERE b.user_id = p.user_id) AS last_activity
    FROM public.profiles p
    WHERE p.tenant_id = v_tenant
      AND NOT EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.user_id = p.user_id AND b.starts_at >= now() - interval '60 days'
      )
    ORDER BY p.member_since ASC
    LIMIT 10
  ) t;

  -- Top socios estrella
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_stars FROM (
    SELECT
      p.user_id,
      p.first_name || ' ' || p.last_name AS name,
      COUNT(b.id) AS bookings_count
    FROM public.profiles p
    JOIN public.bookings b ON b.user_id = p.user_id AND b.tenant_id = v_tenant
    WHERE p.tenant_id = v_tenant
      AND b.starts_at >= p_from AND b.starts_at < p_to
    GROUP BY p.user_id, p.first_name, p.last_name
    ORDER BY bookings_count DESC
    LIMIT 10
  ) t;

  -- Funnel de desafíos (enum: propuesto, aceptado, rechazado, programado, jugado, expirado, cancelado)
  SELECT jsonb_build_object(
    'enviados', COUNT(*),
    'aceptados', COUNT(*) FILTER (WHERE status IN ('aceptado','programado','jugado')),
    'jugados', COUNT(*) FILTER (WHERE status = 'jugado')
  ) INTO v_funnel
  FROM public.ladder_challenges
  WHERE tenant_id = v_tenant
    AND created_at >= p_from AND created_at < p_to;

  RETURN jsonb_build_object(
    'total_members', v_total_members,
    'avg_bookings_per_member', ROUND(v_avg_bookings, 1),
    'distribution', v_distribution,
    'at_risk', v_at_risk,
    'stars', v_stars,
    'challenge_funnel', v_funnel
  );
END;
$function$;