-- Función agregada que devuelve conteos de acciones pendientes de ladder
CREATE OR REPLACE FUNCTION public.ladder_pending_counts()
RETURNS TABLE (
  challenges_received INTEGER,    -- desafíos donde soy el desafiado en estado 'propuesto'
  results_to_confirm INTEGER,     -- resultados que el rival propuso y me toca confirmar
  scheduled_matches INTEGER,      -- partidos programados donde participo
  expiring_soon INTEGER,          -- desafíos donde participo que expiran en <24h y siguen propuestos
  total INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_received INTEGER := 0;
  v_results  INTEGER := 0;
  v_sched    INTEGER := 0;
  v_expiring INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    challenges_received := 0;
    results_to_confirm := 0;
    scheduled_matches := 0;
    expiring_soon := 0;
    total := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Desafíos recibidos en estado 'propuesto'
  SELECT COUNT(*)::INTEGER INTO v_received
  FROM public.ladder_challenges c
  WHERE c.status = 'propuesto'
    AND c.challenged_user_id = v_user_id
    AND c.expires_at > now();

  -- Resultados que el rival propuso y me toca confirmar
  SELECT COUNT(*)::INTEGER INTO v_results
  FROM public.ladder_challenges c
  WHERE c.result_proposed_at IS NOT NULL
    AND c.result_confirmed_at IS NULL
    AND c.status IN ('programado','aceptado')
    AND c.result_proposed_by IS NOT NULL
    AND c.result_proposed_by <> v_user_id
    AND (c.challenger_user_id = v_user_id OR c.challenged_user_id = v_user_id);

  -- Partidos programados donde participo (futuros)
  SELECT COUNT(*)::INTEGER INTO v_sched
  FROM public.ladder_challenges c
  WHERE c.status = 'programado'
    AND c.scheduled_at IS NOT NULL
    AND c.scheduled_at > now()
    AND (c.challenger_user_id = v_user_id OR c.challenged_user_id = v_user_id);

  -- Desafíos donde participo que expiran en menos de 24h y siguen propuestos
  SELECT COUNT(*)::INTEGER INTO v_expiring
  FROM public.ladder_challenges c
  WHERE c.status = 'propuesto'
    AND c.expires_at > now()
    AND c.expires_at < now() + interval '24 hours'
    AND (c.challenger_user_id = v_user_id OR c.challenged_user_id = v_user_id);

  challenges_received := v_received;
  results_to_confirm := v_results;
  scheduled_matches := v_sched;
  expiring_soon := v_expiring;
  total := v_received + v_results;  -- solo lo que requiere acción para el badge
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ladder_pending_counts() TO authenticated;