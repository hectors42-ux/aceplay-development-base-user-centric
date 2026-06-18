CREATE OR REPLACE FUNCTION public.notifications_feed()
RETURNS TABLE(kind text, ref_id uuid, title text, description text, link text, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  v_tenant_id := public.user_tenant_id(v_user_id);

  -- Anuncios del club (admin) → llegan al feed como notificaciones
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

  -- Resultados de torneo propuestos por el rival
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

  -- Ladder: desafío recibido (propuesto, soy el desafiado)
  RETURN QUERY
  SELECT 'ladder_challenge'::TEXT, lc.id,
    'Desafío recibido'::TEXT,
    ('Te retaron en ' || COALESCE(l.name, 'la pirámide'))::TEXT,
    '/ranking?tab=piramide'::TEXT,
    lc.proposed_at
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.status = 'propuesto' AND lc.challenged_user_id = v_user_id;

  -- Ladder: desafío aceptado, esperar elección de horario por mi parte
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

  -- Notificaciones persistentes (partner_*, tournament_match_scheduled, challenge_expired, etc.)
  RETURN QUERY
  SELECT un.kind, un.ref_id, un.title, COALESCE(un.description,''), COALESCE(un.link,''), un.created_at
  FROM public.user_notifications un
  WHERE un.user_id = v_user_id;
END;
$$;