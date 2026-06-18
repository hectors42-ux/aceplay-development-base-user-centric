CREATE OR REPLACE FUNCTION public.notifications_feed()
RETURNS TABLE (
  kind TEXT,           -- 'result_proposal' | 'reschedule_request' | 'doubles_invitation' | 'admin_registration' | 'ladder_challenge' | 'ladder_result'
  ref_id UUID,         -- id del registro fuente
  title TEXT,
  description TEXT,
  link TEXT,           -- ruta relativa para navegar
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    ('/torneos/' || t.slug || '/cat/' || c.id)::TEXT,
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
    ('/torneos/' || t.slug || '/cat/' || c.id)::TEXT,
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
    ('/torneos/' || t.slug || '/cat/' || c.id)::TEXT,
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
      ('/admin/torneos/' || t.id)::TEXT,
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
    '/ladder'::TEXT,
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
    '/ladder'::TEXT,
    ch.result_proposed_at
  FROM public.ladder_challenges ch
  JOIN public.ladders l ON l.id = ch.ladder_id
  WHERE ch.result_proposed_at IS NOT NULL
    AND ch.result_confirmed_at IS NULL
    AND ch.status IN ('programado','aceptado')
    AND ch.result_proposed_by IS NOT NULL
    AND ch.result_proposed_by <> v_user_id
    AND (ch.challenger_user_id = v_user_id OR ch.challenged_user_id = v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notifications_feed() TO authenticated;