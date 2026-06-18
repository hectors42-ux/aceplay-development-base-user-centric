CREATE OR REPLACE FUNCTION public.notifications_feed()
RETURNS TABLE(kind text, ref_id uuid, title text, description text, link text, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  v_tenant_id := public.user_tenant_id(v_user_id);

  IF v_tenant_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 'club_announcement'::TEXT, a.id,
      a.title::TEXT,
      COALESCE(a.body, '')::TEXT,
      COALESCE(a.cta_url, '')::TEXT,
      a.starts_at
    FROM public.club_announcements a
    WHERE a.tenant_id = v_tenant_id
      AND a.is_published = true
      AND a.starts_at <= now()
      AND (a.ends_at IS NULL OR a.ends_at >= now());
  END IF;

  RETURN QUERY
  SELECT 'result_proposal'::TEXT, r.id,
    'Resultado por confirmar'::TEXT,
    ('Tu rival propuso un resultado en ' || COALESCE(t.name, 'un torneo'))::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=match&match=' || m.id)::TEXT,
    r.created_at
  FROM public.tournament_match_results r
  JOIN public.tournament_matches m ON m.id = r.match_id
  JOIN public.tournament_categories c ON c.id = m.category_id
  JOIN public.tournaments t ON t.id = m.tournament_id
  WHERE r.status = 'propuesto' AND r.proposed_by <> v_user_id
    AND public.is_match_player(v_user_id, r.match_id);

  RETURN QUERY
  SELECT 'reschedule_request'::TEXT, rr.id,
    'Reagendamiento por responder'::TEXT,
    ('Te proponen mover un partido en ' || COALESCE(t.name, 'un torneo'))::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=match&match=' || m.id)::TEXT,
    rr.created_at
  FROM public.tournament_match_reschedule_requests rr
  JOIN public.tournament_matches m ON m.id = rr.match_id
  JOIN public.tournament_categories c ON c.id = m.category_id
  JOIN public.tournaments t ON t.id = m.tournament_id
  WHERE rr.status = 'pendiente' AND rr.proposed_by <> v_user_id
    AND public.is_match_player(v_user_id, rr.match_id);

  RETURN QUERY
  SELECT 'doubles_invitation'::TEXT, reg.id,
    'Invitación de pareja'::TEXT,
    ('Te invitaron a jugar dobles en ' || COALESCE(t.name, 'un torneo'))::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=invitations')::TEXT,
    reg.created_at
  FROM public.tournament_registrations reg
  JOIN public.tournament_categories c ON c.id = reg.category_id
  JOIN public.tournaments t ON t.id = reg.tournament_id
  WHERE reg.status = 'pendiente_pareja' AND reg.player2_user_id = v_user_id;

  IF v_tenant_id IS NOT NULL AND public.is_club_admin_of(v_user_id, v_tenant_id) THEN
    RETURN QUERY
    SELECT 'admin_registration'::TEXT, reg.id,
      'Inscripción por aprobar'::TEXT,
      ('Hay solicitudes en ' || COALESCE(t.name, 'un torneo'))::TEXT,
      ('/admin/torneos/' || t.id || '?focus=registrations')::TEXT,
      reg.created_at
    FROM public.tournament_registrations reg
    JOIN public.tournaments t ON t.id = reg.tournament_id
    WHERE reg.status = 'pendiente_admin' AND reg.tenant_id = v_tenant_id;
  END IF;

  RETURN QUERY
  SELECT 'ladder_challenge'::TEXT, lc.id,
    'Desafío recibido'::TEXT,
    ('Te retaron en ' || COALESCE(l.name, 'la pirámide'))::TEXT,
    '/ranking?tab=piramide'::TEXT,
    lc.proposed_at
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.status = 'propuesto' AND lc.challenged_user_id = v_user_id;

  RETURN QUERY
  SELECT 'ladder_propose_slots'::TEXT, lc.id,
    'Elige un horario'::TEXT,
    ('Tu rival propuso 3 horarios en ' || COALESCE(l.name, 'la pirámide'))::TEXT,
    '/ranking?tab=piramide'::TEXT,
    lcsp.proposed_at
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  JOIN public.ladder_challenge_schedule_proposals lcsp ON lcsp.challenge_id = lc.id AND lcsp.status='pendiente'
  WHERE lc.status = 'aceptado'
    AND lc.challenged_user_id = v_user_id
    AND lcsp.proposed_by = lc.challenger_user_id;

  -- Sintético: desafío de pirámide aceptado, horario pasó +2h sin resultado
  RETURN QUERY
  SELECT 'result_to_load'::TEXT, lc.id,
    'Carga el resultado'::TEXT,
    ('Tu desafío en ' || COALESCE(l.name, 'la pirámide') || ' terminó. Sube el marcador.')::TEXT,
    '/ranking?tab=piramide&openResult=1'::TEXT,
    lc.scheduled_at + INTERVAL '2 hours'
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.status = 'aceptado'
    AND lc.result_proposed_at IS NULL
    AND lc.scheduled_at IS NOT NULL
    AND lc.scheduled_at + INTERVAL '2 hours' < now()
    AND (lc.challenger_user_id = v_user_id OR lc.challenged_user_id = v_user_id);

  -- Sintético: invitación partner aceptada, slot pasó +2h sin resultado
  RETURN QUERY
  SELECT 'result_to_load'::TEXT, mi.id,
    'Carga el resultado'::TEXT,
    'Tu partido terminó. Sube el marcador para actualizar tu rating.'::TEXT,
    ('/partner/match/' || mi.id || '?openResult=1')::TEXT,
    ((mi.selected_slot->>'starts_at')::timestamptz) + INTERVAL '2 hours'
  FROM public.match_invitations mi
  LEFT JOIN public.partner_match_results pr ON pr.invitation_id = mi.id
  WHERE mi.status = 'accepted'
    AND (mi.inviter_user_id = v_user_id OR mi.invitee_user_id = v_user_id)
    AND mi.selected_slot IS NOT NULL
    AND ((mi.selected_slot->>'starts_at')::timestamptz) + INTERVAL '2 hours' < now()
    AND (pr.invitation_id IS NULL OR pr.status = 'rechazado');

  -- Sintético: partido de torneo programado, +2h sin score
  RETURN QUERY
  SELECT 'result_to_load'::TEXT, m.id,
    'Carga el resultado'::TEXT,
    ('Tu partido en ' || COALESCE(t.name, 'el torneo') || ' terminó. Sube el marcador.')::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=match&match=' || m.id || '&openResult=1')::TEXT,
    m.scheduled_at + INTERVAL '2 hours'
  FROM public.tournament_matches m
  JOIN public.tournament_categories c ON c.id = m.category_id
  JOIN public.tournaments t ON t.id = m.tournament_id
  LEFT JOIN public.tournament_match_results r
    ON r.match_id = m.id AND r.status IN ('propuesto','confirmado')
  WHERE m.scheduled_at IS NOT NULL
    AND m.scheduled_at + INTERVAL '2 hours' < now()
    AND m.winner_registration_id IS NULL
    AND m.walkover = false
    AND r.id IS NULL
    AND public.is_match_player(v_user_id, m.id);

  RETURN QUERY
  SELECT un.kind, un.ref_id, un.title, COALESCE(un.description,''), COALESCE(un.link,''), un.created_at
  FROM public.user_notifications un
  WHERE un.user_id = v_user_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.home_pending_actions();

CREATE OR REPLACE FUNCTION public.home_pending_actions()
RETURNS TABLE(
  ladder_challenges_received integer,
  ladder_results_to_confirm integer,
  tournament_results_to_confirm integer,
  doubles_invitations integer,
  reschedule_requests integer,
  partner_results_to_load integer,
  partner_results_to_confirm integer,
  results_to_load integer,
  total integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lcr AS (
    SELECT count(*)::int AS n FROM public.ladder_challenges
    WHERE challenged_user_id = auth.uid() AND status = 'propuesto'
  ),
  lrc AS (
    SELECT count(*)::int AS n FROM public.ladder_challenges
    WHERE result_proposed_at IS NOT NULL
      AND result_confirmed_at IS NULL
      AND result_proposed_by IS DISTINCT FROM auth.uid()
      AND (challenger_user_id = auth.uid() OR challenged_user_id = auth.uid())
  ),
  trc AS (
    SELECT count(*)::int AS n
    FROM public.tournament_match_results r
    JOIN public.tournament_matches m ON m.id = r.match_id
    WHERE r.status = 'propuesto'
      AND r.proposed_by IS DISTINCT FROM auth.uid()
      AND public.is_match_player(auth.uid(), m.id)
  ),
  di AS (
    SELECT count(*)::int AS n FROM public.tournament_registrations
    WHERE player2_user_id = auth.uid() AND status = 'pendiente_pareja'
  ),
  rsr AS (
    SELECT count(*)::int AS n
    FROM public.tournament_match_reschedule_requests rr
    JOIN public.tournament_matches m ON m.id = rr.match_id
    WHERE rr.status = 'pendiente'
      AND rr.proposed_by IS DISTINCT FROM auth.uid()
      AND public.is_match_player(auth.uid(), m.id)
  ),
  prl AS (
    SELECT count(*)::int AS n FROM public.match_invitations mi
    LEFT JOIN public.partner_match_results pr ON pr.invitation_id = mi.id
    WHERE mi.status = 'accepted'
      AND (mi.inviter_user_id = auth.uid() OR mi.invitee_user_id = auth.uid())
      AND ((mi.selected_slot->>'starts_at')::timestamptz) < now()
      AND (pr.invitation_id IS NULL OR pr.status = 'rechazado')
  ),
  prc AS (
    SELECT count(*)::int AS n FROM public.partner_match_results pr
    JOIN public.match_invitations mi ON mi.id = pr.invitation_id
    WHERE pr.status = 'propuesto'
      AND pr.proposed_by IS DISTINCT FROM auth.uid()
      AND (mi.inviter_user_id = auth.uid() OR mi.invitee_user_id = auth.uid())
  ),
  rtl AS (
    SELECT (
      (SELECT count(*) FROM public.ladder_challenges lc
        WHERE lc.status = 'aceptado'
          AND lc.result_proposed_at IS NULL
          AND lc.scheduled_at IS NOT NULL
          AND lc.scheduled_at + INTERVAL '2 hours' < now()
          AND (lc.challenger_user_id = auth.uid() OR lc.challenged_user_id = auth.uid()))
      +
      (SELECT count(*) FROM public.match_invitations mi
        LEFT JOIN public.partner_match_results pr ON pr.invitation_id = mi.id
        WHERE mi.status = 'accepted'
          AND (mi.inviter_user_id = auth.uid() OR mi.invitee_user_id = auth.uid())
          AND mi.selected_slot IS NOT NULL
          AND ((mi.selected_slot->>'starts_at')::timestamptz) + INTERVAL '2 hours' < now()
          AND (pr.invitation_id IS NULL OR pr.status = 'rechazado'))
      +
      (SELECT count(*) FROM public.tournament_matches m
        LEFT JOIN public.tournament_match_results r ON r.match_id = m.id AND r.status IN ('propuesto', 'confirmado')
        WHERE m.scheduled_at IS NOT NULL
          AND m.scheduled_at + INTERVAL '2 hours' < now()
          AND m.winner_registration_id IS NULL
          AND m.walkover = false
          AND r.id IS NULL
          AND public.is_match_player(auth.uid(), m.id))
    )::int AS n
  )
  SELECT
    lcr.n, lrc.n, trc.n, di.n, rsr.n, prl.n, prc.n, rtl.n,
    (lcr.n + lrc.n + trc.n + di.n + rsr.n + prl.n + prc.n + rtl.n) AS total
  FROM lcr, lrc, trc, di, rsr, prl, prc, rtl;
$$;