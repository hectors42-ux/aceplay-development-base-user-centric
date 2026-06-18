-- Función agregada que devuelve los conteos de acciones pendientes para el usuario actual
CREATE OR REPLACE FUNCTION public.tournament_pending_counts()
RETURNS TABLE (
  result_proposals INTEGER,
  reschedule_requests INTEGER,
  doubles_invitations INTEGER,
  admin_pending_registrations INTEGER,
  total INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_results INTEGER := 0;
  v_resched INTEGER := 0;
  v_dobles  INTEGER := 0;
  v_admin   INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    result_proposals := 0;
    reschedule_requests := 0;
    doubles_invitations := 0;
    admin_pending_registrations := 0;
    total := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  v_tenant_id := public.user_tenant_id(v_user_id);

  -- Resultados propuestos donde soy el rival (no propuse yo)
  SELECT COUNT(*)::INTEGER INTO v_results
  FROM public.tournament_match_results r
  WHERE r.status = 'propuesto'
    AND r.proposed_by <> v_user_id
    AND public.is_match_player(v_user_id, r.match_id);

  -- Reagendamientos pendientes donde soy el rival
  SELECT COUNT(*)::INTEGER INTO v_resched
  FROM public.tournament_match_reschedule_requests rr
  WHERE rr.status = 'pendiente'
    AND rr.proposed_by <> v_user_id
    AND public.is_match_player(v_user_id, rr.match_id);

  -- Invitaciones de dobles pendientes para mí (player2)
  SELECT COUNT(*)::INTEGER INTO v_dobles
  FROM public.tournament_registrations reg
  WHERE reg.status = 'pendiente_pareja'
    AND reg.player2_user_id = v_user_id;

  -- Inscripciones pendientes_admin (solo si soy club_admin del tenant)
  IF v_tenant_id IS NOT NULL AND public.is_club_admin_of(v_user_id, v_tenant_id) THEN
    SELECT COUNT(*)::INTEGER INTO v_admin
    FROM public.tournament_registrations reg
    WHERE reg.status = 'pendiente_admin'
      AND reg.tenant_id = v_tenant_id;
  END IF;

  result_proposals := v_results;
  reschedule_requests := v_resched;
  doubles_invitations := v_dobles;
  admin_pending_registrations := v_admin;
  total := v_results + v_resched + v_dobles + v_admin;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tournament_pending_counts() TO authenticated;