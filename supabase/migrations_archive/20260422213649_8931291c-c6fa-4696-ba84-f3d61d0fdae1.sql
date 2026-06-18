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
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  v_tenant_id := public.user_tenant_id(v_user_id);

  -- Resultados de torneo propuestos por el rival
  RETURN QUERY
  SELECT
    'result_proposal'::TEXT,
    r.id,
    'Resultado por confirmar'::TEXT,
    ('Tu rival propuso un resultado en ' || COALESCE(t.name, 'un torneo'))::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=match&match=' || m.id)::TEXT,
    r.created_at
  FROM public.tournament_match_results r
  JOIN public.tournament_matches m ON m.id = r.match_id
  JOIN public.tournament_categories c ON c.id = m.category_id
  JOIN public.tournaments t ON t.id = m.tournament_id
  WHERE r.status = 'propuesto'
    AND r.proposed_by <> v_user_id
    AND public.is_match_player(v_user_id, r.match_id);

  -- Reagendamientos pendientes
  RETURN QUERY
  SELECT
    'reschedule_request'::TEXT,
    rr.id,
    'Reagendamiento por responder'::TEXT,
    ('Te proponen mover un partido en ' || COALESCE(t.name, 'un torneo'))::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=match&match=' || m.id)::TEXT,
    rr.created_at
  FROM public.tournament_match_reschedule_requests rr
  JOIN public.tournament_matches m ON m.id = rr.match_id
  JOIN public.tournament_categories c ON c.id = m.category_id
  JOIN public.tournaments t ON t.id = m.tournament_id
  WHERE rr.status = 'pendiente'
    AND rr.proposed_by <> v_user_id
    AND public.is_match_player(v_user_id, rr.match_id);

  -- Invitaciones de dobles
  RETURN QUERY
  SELECT
    'doubles_invitation'::TEXT,
    reg.id,
    'Invitación de pareja'::TEXT,
    ('Te invitaron a jugar dobles en ' || COALESCE(t.name, 'un torneo'))::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=invitations')::TEXT,
    reg.created_at
  FROM public.tournament_registrations reg
  JOIN public.tournament_categories c ON c.id = reg.category_id
  JOIN public.tournaments t ON t.id = reg.tournament_id
  WHERE reg.status = 'pendiente_pareja'
    AND reg.player2_user_id = v_user_id;

  -- Inscripciones pendientes_admin (solo para club_admin)
  IF v_tenant_id IS NOT NULL AND public.is_club_admin_of(v_user_id, v_tenant_id) THEN
    RETURN QUERY
    SELECT
      'admin_registration'::TEXT,
      reg.id,
      'Inscripción por aprobar'::TEXT,
      ('Hay solicitudes en ' || COALESCE(t.name, 'un torneo'))::TEXT,
      ('/admin/torneos/' || t.id || '?focus=registrations')::TEXT,
      reg.created_at
    FROM public.tournament_registrations reg
    JOIN public.tournaments t ON t.id = reg.tournament_id
    WHERE reg.status = 'pendiente_admin'
      AND reg.tenant_id = v_tenant_id;
  END IF;

  -- Desafíos de ladder recibidos
  RETURN QUERY
  SELECT
    'ladder_challenge'::TEXT,
    ch.id,
    'Nuevo desafío'::TEXT,
    ('Te desafiaron en ' || COALESCE(l.name, 'la pirámide'))::TEXT,
    '/ladder?tab=piramide&focus=challenges'::TEXT,
    ch.created_at
  FROM public.ladder_challenges ch
  JOIN public.ladders l ON l.id = ch.ladder_id
  WHERE ch.status = 'propuesto'
    AND ch.challenged_user_id = v_user_id
    AND ch.expires_at > now();

  -- Resultados de ladder por confirmar
  RETURN QUERY
  SELECT
    'ladder_result'::TEXT,
    ch.id,
    'Resultado de ladder por confirmar'::TEXT,
    ('Tu rival propuso un resultado en ' || COALESCE(l.name, 'la pirámide'))::TEXT,
    '/ladder?tab=piramide&focus=challenges'::TEXT,
    ch.result_proposed_at
  FROM public.ladder_challenges ch
  JOIN public.ladders l ON l.id = ch.ladder_id
  WHERE ch.result_proposed_at IS NOT NULL
    AND ch.result_confirmed_at IS NULL
    AND ch.status IN ('programado','aceptado')
    AND ch.result_proposed_by IS NOT NULL
    AND ch.result_proposed_by <> v_user_id
    AND (ch.challenger_user_id = v_user_id OR ch.challenged_user_id = v_user_id);

  -- NUEVO: Reservas de cancha donde fuiste agregado como pareja
  RETURN QUERY
  SELECT
    'booking_partner'::TEXT,
    b.id,
    'Te agregaron a una reserva'::TEXT,
    ('Reserva en ' || COALESCE(co.name, 'cancha') || ' el '
      || to_char(b.starts_at AT TIME ZONE COALESCE(te.timezone, 'America/Santiago'),
                 'DD Mon HH24:MI'))::TEXT,
    '/reservar'::TEXT,
    b.created_at
  FROM public.bookings b
  JOIN public.courts co ON co.id = b.court_id
  LEFT JOIN public.tenants te ON te.id = b.tenant_id
  WHERE b.partner_user_id = v_user_id
    AND b.status = 'confirmada'
    AND b.starts_at > now()
    AND b.user_id <> v_user_id;

  -- NUEVO: Partidos de torneo programados pendientes de tu aceptación
  RETURN QUERY
  SELECT
    'match_acceptance'::TEXT,
    m.id,
    'Partido por aceptar'::TEXT,
    ('Te programaron un partido en ' || COALESCE(t.name, 'un torneo')
      || CASE WHEN m.scheduled_at IS NOT NULL
           THEN ' · ' || to_char(m.scheduled_at AT TIME ZONE COALESCE(te.timezone, 'America/Santiago'), 'DD Mon HH24:MI')
           ELSE '' END)::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=match&match=' || m.id)::TEXT,
    COALESCE(m.updated_at, m.created_at)
  FROM public.tournament_matches m
  JOIN public.tournament_categories c ON c.id = m.category_id
  JOIN public.tournaments t ON t.id = m.tournament_id
  LEFT JOIN public.tenants te ON te.id = m.tenant_id
  WHERE m.status = 'programado'
    AND m.scheduled_at IS NOT NULL
    AND public.is_match_player(v_user_id, m.id)
    AND (
      (public.is_match_side_a(v_user_id, m.id) AND m.acceptance_a = 'pending')
      OR (public.is_match_side_b(v_user_id, m.id) AND m.acceptance_b = 'pending')
    );

  -- NUEVO: Clases donde te invitaron como segundo alumno
  RETURN QUERY
  SELECT
    'class_invitation'::TEXT,
    cb.id,
    'Te invitaron a una clase'::TEXT,
    ('Clase ' || cb.kind::TEXT || ' el '
      || to_char(cb.starts_at AT TIME ZONE COALESCE(te.timezone, 'America/Santiago'),
                 'DD Mon HH24:MI'))::TEXT,
    '/clases'::TEXT,
    cb.created_at
  FROM public.coach_class_bookings cb
  LEFT JOIN public.tenants te ON te.id = cb.tenant_id
  WHERE cb.student2_user_id = v_user_id
    AND cb.status IN ('propuesta','confirmada')
    AND cb.starts_at > now()
    AND cb.created_by <> v_user_id;
END;
$function$;

-- Helpers: lados A/B del partido (si no existen ya)
CREATE OR REPLACE FUNCTION public.is_match_side_a(_user_id uuid, _match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tournament_matches m
    LEFT JOIN public.tournament_registrations ra ON ra.id = m.registration_a_id
    WHERE m.id = _match_id
      AND (ra.player1_user_id = _user_id OR ra.player2_user_id = _user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_match_side_b(_user_id uuid, _match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tournament_matches m
    LEFT JOIN public.tournament_registrations rb ON rb.id = m.registration_b_id
    WHERE m.id = _match_id
      AND (rb.player1_user_id = _user_id OR rb.player2_user_id = _user_id)
  );
$$;