-- =========================================================
-- S7 Analytics Fase 1: tablas + funciones agregadoras
-- =========================================================

-- 1. Tabla de umbrales configurables por tenant
CREATE TABLE IF NOT EXISTS public.analytics_thresholds (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  mora_critica_clp bigint NOT NULL DEFAULT 500000,
  ocupacion_critica_pct numeric NOT NULL DEFAULT 95,
  ocupacion_valle_pct numeric NOT NULL DEFAULT 40,
  inactividad_riesgo_dias integer NOT NULL DEFAULT 60,
  inactividad_critica_dias integer NOT NULL DEFAULT 90,
  caida_actividad_pct numeric NOT NULL DEFAULT 20,
  peak_hour_start integer NOT NULL DEFAULT 18,
  peak_hour_end integer NOT NULL DEFAULT 22,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_admin gestiona umbrales de su club"
  ON public.analytics_thresholds
  FOR ALL
  TO authenticated
  USING (is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

CREATE POLICY "super_admin gestiona todos los umbrales"
  ON public.analytics_thresholds
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER update_analytics_thresholds_updated_at
  BEFORE UPDATE ON public.analytics_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sembrar umbrales por defecto para tenants existentes
INSERT INTO public.analytics_thresholds (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- 2. Tabla de eventos de telemetría
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid,
  event_name text NOT NULL,
  event_props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_event_time
  ON public.analytics_events (tenant_id, event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time
  ON public.analytics_events (user_id, created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios insertan eventos de su club"
  ON public.analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = user_tenant_id(auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "club_admin lee eventos de su club"
  ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (
    is_club_admin_of(auth.uid(), tenant_id)
    OR is_super_admin(auth.uid())
  );

-- =========================================================
-- 3. Funciones agregadoras
-- =========================================================

-- Helper: tenant del usuario actual con guard de admin
CREATE OR REPLACE FUNCTION public._analytics_guard()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := user_tenant_id(auth.uid());
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No tenant for current user';
  END IF;
  IF NOT (is_club_admin_of(auth.uid(), v_tenant) OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden: requires club_admin role';
  END IF;
  RETURN v_tenant;
END;
$$;

-- 3.1 Overview ejecutivo
CREATE OR REPLACE FUNCTION public.analytics_overview(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public._analytics_guard();
  v_period_seconds numeric := GREATEST(EXTRACT(EPOCH FROM (p_to - p_from)), 1);
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
BEGIN
  -- Capacidad total: para cada cancha activa, slots disponibles entre p_from y p_to
  SELECT COALESCE(SUM(
    GREATEST(0,
      EXTRACT(EPOCH FROM (LEAST(p_to, (date_trunc('day', p_to) + c.closes_at))
                          - GREATEST(p_from, (date_trunc('day', p_from) + c.opens_at))))
    )
  ), 0)
  INTO v_total_slot_seconds
  FROM public.courts c
  WHERE c.tenant_id = v_tenant AND c.is_active = true;

  -- Aproximación: capacidad = sum( días * (closes-opens) * canchas )
  SELECT COALESCE(SUM(
    GREATEST(EXTRACT(EPOCH FROM (p_to - p_from)) / 86400.0, 1)
    * EXTRACT(EPOCH FROM (c.closes_at - c.opens_at))
  ), 0)
  INTO v_total_slot_seconds
  FROM public.courts c
  WHERE c.tenant_id = v_tenant AND c.is_active = true;

  -- Reservas confirmadas en el período
  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (b.ends_at - b.starts_at))), 0)
  INTO v_booked_seconds
  FROM public.bookings b
  WHERE b.tenant_id = v_tenant
    AND b.status = 'confirmada'
    AND b.starts_at >= p_from AND b.starts_at < p_to;

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (b.ends_at - b.starts_at))), 0)
  INTO v_prev_booked_seconds
  FROM public.bookings b
  WHERE b.tenant_id = v_tenant
    AND b.status = 'confirmada'
    AND b.starts_at >= v_prev_from AND b.starts_at < v_prev_to;

  v_occupancy_pct := CASE WHEN v_total_slot_seconds > 0
    THEN ROUND((v_booked_seconds / v_total_slot_seconds * 100)::numeric, 1)
    ELSE 0 END;
  v_prev_occupancy_pct := CASE WHEN v_total_slot_seconds > 0
    THEN ROUND((v_prev_booked_seconds / v_total_slot_seconds * 100)::numeric, 1)
    ELSE 0 END;

  -- Socios activos últimos 30 días (combinando fuentes)
  WITH active AS (
    SELECT user_id FROM public.bookings
      WHERE tenant_id = v_tenant AND starts_at >= now() - interval '30 days'
    UNION
    SELECT challenger_user_id FROM public.ladder_challenges
      WHERE tenant_id = v_tenant AND created_at >= now() - interval '30 days'
    UNION
    SELECT challenged_user_id FROM public.ladder_challenges
      WHERE tenant_id = v_tenant AND created_at >= now() - interval '30 days'
    UNION
    SELECT student1_user_id FROM public.coach_class_bookings
      WHERE tenant_id = v_tenant AND starts_at >= now() - interval '30 days' AND student1_user_id IS NOT NULL
  )
  SELECT COUNT(DISTINCT user_id) INTO v_active_members FROM active WHERE user_id IS NOT NULL;

  SELECT COUNT(*) INTO v_inactive_members
  FROM public.profiles p
  WHERE p.tenant_id = v_tenant
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.user_id = p.user_id AND b.starts_at >= now() - interval '30 days'
    );

  SELECT COUNT(*) INTO v_morosos
  FROM public.profiles p
  WHERE p.tenant_id = v_tenant AND p.dues_status = 'moroso';

  -- Torneos activos (solo si la tabla existe)
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public.tournaments WHERE tenant_id = $1 AND status IN (''inscripcion'',''en_curso'')'
      INTO v_active_tournaments USING v_tenant;
  EXCEPTION WHEN undefined_table THEN
    v_active_tournaments := 0;
  END;

  SELECT COUNT(*) INTO v_active_challenges
  FROM public.ladder_challenges
  WHERE tenant_id = v_tenant
    AND status IN ('propuesto','aceptado','agendado');

  SELECT
    (SELECT COUNT(*) FROM public.ladder_challenges
       WHERE tenant_id = v_tenant
         AND played_at >= now() - interval '7 days'
         AND status = 'jugado')
    +
    (SELECT COUNT(*) FROM public.tournament_matches
       WHERE tenant_id = v_tenant
         AND played_at >= now() - interval '7 days'
         AND status = 'jugado')
  INTO v_matches_week;

  SELECT COALESCE(SUM(price_clp), 0)::bigint INTO v_clases_revenue
  FROM public.coach_class_bookings
  WHERE tenant_id = v_tenant
    AND payment_status = 'pagado'
    AND paid_at >= p_from AND paid_at < p_to;

  -- Top 3 coaches
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_top_coaches FROM (
    SELECT
      cp.id,
      pr.first_name || ' ' || pr.last_name AS name,
      COUNT(ccb.id)::int AS classes,
      COALESCE(SUM(ccb.price_clp), 0)::bigint AS revenue
    FROM public.coach_class_bookings ccb
    JOIN public.coach_profiles cp ON cp.id = ccb.coach_id
    LEFT JOIN public.profiles pr ON pr.user_id = cp.user_id AND pr.tenant_id = v_tenant
    WHERE ccb.tenant_id = v_tenant
      AND ccb.starts_at >= p_from AND ccb.starts_at < p_to
      AND ccb.status NOT IN ('cancelada')
    GROUP BY cp.id, pr.first_name, pr.last_name
    ORDER BY classes DESC
    LIMIT 3
  ) t;

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
    'period_from', p_from,
    'period_to', p_to,
    'health_score', LEAST(100, GREATEST(0,
      ROUND(
        (COALESCE(v_occupancy_pct, 0) * 0.4
         + LEAST(100, COALESCE(v_active_members, 0) * 2) * 0.4
         + GREATEST(0, 100 - COALESCE(v_morosos, 0) * 5) * 0.2)::numeric, 0
      )
    ))
  );
END;
$$;

-- 3.2 Heatmap día×hora×cancha
CREATE OR REPLACE FUNCTION public.analytics_occupancy_heatmap(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(weekday integer, hour integer, court_id uuid, court_name text, occupied_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public._analytics_guard();
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
  WHERE b.tenant_id = v_tenant
    AND b.status = 'confirmada'
    AND b.starts_at >= p_from AND b.starts_at < p_to
  GROUP BY 1, 2, 3, 4
  ORDER BY 1, 2;
END;
$$;

-- 3.3 Finanzas
CREATE OR REPLACE FUNCTION public.analytics_finance_summary(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public._analytics_guard();
  v_clases bigint;
  v_morosos_total integer;
  v_morosos_30 integer;
  v_morosos_60 integer;
  v_morosos_90 integer;
  v_revenue_by_day jsonb;
BEGIN
  SELECT COALESCE(SUM(price_clp), 0)::bigint INTO v_clases
  FROM public.coach_class_bookings
  WHERE tenant_id = v_tenant
    AND payment_status = 'pagado'
    AND paid_at >= p_from AND paid_at < p_to;

  SELECT COUNT(*) INTO v_morosos_total
  FROM public.profiles WHERE tenant_id = v_tenant AND dues_status = 'moroso';

  v_morosos_30 := v_morosos_total;
  v_morosos_60 := 0;
  v_morosos_90 := 0;

  SELECT COALESCE(jsonb_agg(t ORDER BY t->>'day'), '[]'::jsonb) INTO v_revenue_by_day FROM (
    SELECT jsonb_build_object(
      'day', date_trunc('day', paid_at)::date,
      'clases', COALESCE(SUM(price_clp), 0)::bigint
    ) AS t
    FROM public.coach_class_bookings
    WHERE tenant_id = v_tenant
      AND payment_status = 'pagado'
      AND paid_at >= p_from AND paid_at < p_to
    GROUP BY date_trunc('day', paid_at)
  ) sub;

  RETURN jsonb_build_object(
    'clases_revenue_clp', v_clases,
    'cuotas_revenue_clp', NULL,
    'reservas_revenue_clp', NULL,
    'torneos_revenue_clp', NULL,
    'morosos_total', v_morosos_total,
    'morosos_30d', v_morosos_30,
    'morosos_60d', v_morosos_60,
    'morosos_90d', v_morosos_90,
    'revenue_by_day', v_revenue_by_day
  );
END;
$$;

-- 3.4 Engagement de socios
CREATE OR REPLACE FUNCTION public.analytics_members_engagement(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Funnel de desafíos
  SELECT jsonb_build_object(
    'enviados', COUNT(*),
    'aceptados', COUNT(*) FILTER (WHERE status IN ('aceptado','agendado','jugado')),
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
$$;

-- 3.5 Coaches
CREATE OR REPLACE FUNCTION public.analytics_coaches_performance(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
      'cancelled', COUNT(ccb.id) FILTER (WHERE ccb.status = 'cancelada')::int
    ) AS t
    FROM public.coach_profiles cp
    LEFT JOIN public.profiles pr ON pr.user_id = cp.user_id AND pr.tenant_id = v_tenant
    LEFT JOIN public.coach_class_bookings ccb
      ON ccb.coach_id = cp.id
     AND ccb.starts_at >= p_from AND ccb.starts_at < p_to
    WHERE cp.tenant_id = v_tenant AND cp.is_active = true
    GROUP BY cp.id, pr.first_name, pr.last_name
  ) sub;

  RETURN jsonb_build_object('coaches', v_coaches);
END;
$$;

-- 3.6 Comunidad
CREATE OR REPLACE FUNCTION public.analytics_community_stats(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public._analytics_guard();
  v_avg_accept_hours numeric;
  v_avg_play_hours numeric;
  v_active_ladders jsonb;
  v_progress jsonb;
  v_decline jsonb;
  v_level_density jsonb;
BEGIN
  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (responded_at - proposed_at))/3600.0), 0)::numeric
  INTO v_avg_accept_hours
  FROM public.ladder_challenges
  WHERE tenant_id = v_tenant
    AND responded_at IS NOT NULL
    AND proposed_at >= p_from AND proposed_at < p_to;

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (played_at - responded_at))/3600.0), 0)::numeric
  INTO v_avg_play_hours
  FROM public.ladder_challenges
  WHERE tenant_id = v_tenant
    AND played_at IS NOT NULL AND responded_at IS NOT NULL
    AND proposed_at >= p_from AND proposed_at < p_to;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'matches')::int DESC), '[]'::jsonb) INTO v_active_ladders FROM (
    SELECT jsonb_build_object(
      'ladder_id', l.id,
      'name', l.name,
      'matches', COUNT(c.id)::int
    ) AS t
    FROM public.ladders l
    LEFT JOIN public.ladder_challenges c
      ON c.ladder_id = l.id AND c.played_at >= p_from AND c.played_at < p_to
    WHERE l.tenant_id = v_tenant AND l.is_active = true
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
    GROUP BY p.user_id, p.first_name, p.last_name
    HAVING SUM(rh.delta) > 0
    ORDER BY SUM(rh.delta) DESC
    LIMIT 5
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
    GROUP BY p.user_id, p.first_name, p.last_name
    HAVING SUM(rh.delta) < 0
    ORDER BY SUM(rh.delta) ASC
    LIMIT 5
  ) sub;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'bucket')::numeric), '[]'::jsonb) INTO v_level_density FROM (
    SELECT jsonb_build_object(
      'bucket', FLOOR(level * 2) / 2.0,
      'count', COUNT(*)
    ) AS t
    FROM public.player_ratings
    WHERE tenant_id = v_tenant
    GROUP BY FLOOR(level * 2) / 2.0
  ) sub;

  RETURN jsonb_build_object(
    'avg_accept_hours', ROUND(v_avg_accept_hours, 1),
    'avg_play_hours', ROUND(v_avg_play_hours, 1),
    'active_ladders', v_active_ladders,
    'top_progress', v_progress,
    'top_decline', v_decline,
    'level_density', v_level_density
  );
END;
$$;

-- 3.7 Alertas (críticas + oportunidades)
CREATE OR REPLACE FUNCTION public.analytics_alerts()
RETURNS TABLE(
  kind text,
  severity text,
  title text,
  body text,
  action_url text,
  metric_value numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public._analytics_guard();
  v_th public.analytics_thresholds%ROWTYPE;
  v_morosos integer;
  v_inactive_premium integer;
  v_low_acceptance integer;
BEGIN
  SELECT * INTO v_th FROM public.analytics_thresholds WHERE tenant_id = v_tenant;
  IF NOT FOUND THEN
    INSERT INTO public.analytics_thresholds (tenant_id) VALUES (v_tenant)
    RETURNING * INTO v_th;
  END IF;

  -- Críticas
  SELECT COUNT(*) INTO v_morosos FROM public.profiles
    WHERE tenant_id = v_tenant AND dues_status = 'moroso';
  IF v_morosos >= 5 THEN
    kind := 'critical'; severity := 'high';
    title := 'Mora alta: ' || v_morosos || ' socios morosos';
    body := 'Hay ' || v_morosos || ' socios con cuotas pendientes. Revisa el listado y considera campaña de cobranza.';
    action_url := '/admin/analytics/finanzas';
    metric_value := v_morosos;
    RETURN NEXT;
  END IF;

  SELECT COUNT(*) INTO v_inactive_premium
  FROM public.profiles p
  WHERE p.tenant_id = v_tenant
    AND p.dues_status = 'al_dia'
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.user_id = p.user_id AND b.starts_at >= now() - (v_th.inactividad_riesgo_dias || ' days')::interval
    );
  IF v_inactive_premium >= 3 THEN
    kind := 'critical'; severity := 'medium';
    title := v_inactive_premium || ' socios al día sin actividad reciente';
    body := 'Socios al día sin reservas en los últimos ' || v_th.inactividad_riesgo_dias || ' días. Considera reactivación.';
    action_url := '/admin/analytics/socios';
    metric_value := v_inactive_premium;
    RETURN NEXT;
  END IF;

  SELECT COUNT(*) INTO v_low_acceptance
  FROM public.ladder_challenges
  WHERE tenant_id = v_tenant
    AND status = 'expirado'
    AND created_at >= now() - interval '14 days';
  IF v_low_acceptance >= 5 THEN
    kind := 'critical'; severity := 'medium';
    title := v_low_acceptance || ' desafíos expirados sin respuesta';
    body := 'Aceptación de desafíos baja en las últimas 2 semanas. Revisa fricciones en el flujo.';
    action_url := '/admin/analytics/comunidad';
    metric_value := v_low_acceptance;
    RETURN NEXT;
  END IF;

  -- Oportunidades
  IF EXISTS (
    SELECT 1 FROM public.player_ratings
    WHERE tenant_id = v_tenant
    GROUP BY FLOOR(level)
    HAVING COUNT(*) >= 8
  ) THEN
    kind := 'opportunity'; severity := 'low';
    title := 'Categoría con masa crítica para nuevo torneo';
    body := 'Detectamos un nivel con ≥8 jugadores activos. Considera lanzar una nueva categoría o torneo.';
    action_url := '/admin/torneos';
    metric_value := NULL;
    RETURN NEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.coach_profiles cp
    WHERE cp.tenant_id = v_tenant AND cp.is_active = true
      AND (
        SELECT COUNT(*) FROM public.coach_class_bookings ccb
        WHERE ccb.coach_id = cp.id AND ccb.starts_at >= now() - interval '14 days'
      ) >= 8
  ) THEN
    kind := 'opportunity'; severity := 'low';
    title := 'Coach con alta demanda';
    body := 'Hay un coach con muchas clases en las últimas 2 semanas. Considera abrir clínica grupal.';
    action_url := '/admin/clases';
    metric_value := NULL;
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$;

-- 3.8 Directory digest (resumen mensual)
CREATE OR REPLACE FUNCTION public.analytics_directory_digest(p_month date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public._analytics_guard();
  v_from timestamptz := date_trunc('month', p_month);
  v_to timestamptz := (date_trunc('month', p_month) + interval '1 month');
  v_overview jsonb;
  v_finance jsonb;
  v_engagement jsonb;
BEGIN
  v_overview := public.analytics_overview(v_from, v_to);
  v_finance := public.analytics_finance_summary(v_from, v_to);
  v_engagement := public.analytics_members_engagement(v_from, v_to);

  RETURN jsonb_build_object(
    'month', p_month,
    'overview', v_overview,
    'finance', v_finance,
    'engagement', v_engagement,
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
$$;