
-- 1) Tabla de banderas de revisión
CREATE TABLE IF NOT EXISTS public.tournament_match_review_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tournament_match_id uuid NOT NULL UNIQUE REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tournament_match_review_flags TO authenticated;
GRANT ALL ON public.tournament_match_review_flags TO service_role;

ALTER TABLE public.tournament_match_review_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Socios leen review flags de su club" ON public.tournament_match_review_flags;
CREATE POLICY "Socios leen review flags de su club"
ON public.tournament_match_review_flags
FOR SELECT
TO authenticated
USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Organizador limpia review flags" ON public.tournament_match_review_flags;
CREATE POLICY "Organizador limpia review flags"
ON public.tournament_match_review_flags
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tournament_matches tm
    WHERE tm.id = tournament_match_id
      AND public.is_tournament_manager(tm.tournament_id)
  )
);

-- 2) Función: baja con walkover
CREATE OR REPLACE FUNCTION public.withdraw_registration_with_walkover(_registration_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg public.tournament_registrations%ROWTYPE;
  v_match public.tournament_matches%ROWTYPE;
  v_rival uuid;
BEGIN
  SELECT * INTO v_reg FROM public.tournament_registrations WHERE id = _registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inscripción no encontrada'; END IF;

  IF NOT public.is_tournament_manager(v_reg.tournament_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.tournament_registrations
     SET status = 'retirada'::public.registration_status,
         withdrawn_at = now(),
         updated_at = now()
   WHERE id = _registration_id;

  -- Buscar el match abierto (pendiente/programado) donde participa
  SELECT * INTO v_match
    FROM public.tournament_matches
   WHERE tournament_category_id = v_reg.tournament_category_id
     AND status IN ('pendiente'::public.match_status, 'programado'::public.match_status)
     AND (registration_a_id = _registration_id OR registration_b_id = _registration_id)
   ORDER BY round ASC
   LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  v_rival := CASE
    WHEN v_match.registration_a_id = _registration_id THEN v_match.registration_b_id
    ELSE v_match.registration_a_id
  END;

  IF v_rival IS NULL THEN
    -- Match sin rival: cancelar
    UPDATE public.tournament_matches
       SET status = 'cancelado'::public.match_status,
           updated_at = now()
     WHERE id = v_match.id;
    RETURN;
  END IF;

  UPDATE public.tournament_matches
     SET status = 'walkover'::public.match_status,
         walkover = true,
         winner_registration_id = v_rival,
         played_at = now(),
         updated_at = now()
   WHERE id = v_match.id;

  -- Propagar al siguiente match si existe
  IF v_match.next_match_id IS NOT NULL AND v_match.next_match_slot IS NOT NULL THEN
    IF v_match.next_match_slot = 'a' THEN
      UPDATE public.tournament_matches SET registration_a_id = v_rival, updated_at = now()
       WHERE id = v_match.next_match_id;
    ELSE
      UPDATE public.tournament_matches SET registration_b_id = v_rival, updated_at = now()
       WHERE id = v_match.next_match_id;
    END IF;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.withdraw_registration_with_walkover(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_registration_with_walkover(uuid) TO authenticated, service_role;

-- 3) Función: reabrir categoría
CREATE OR REPLACE FUNCTION public.reopen_category(_category_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat public.tournament_categories%ROWTYPE;
BEGIN
  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;

  IF NOT public.is_tournament_manager(v_cat.tournament_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tournament_matches
     WHERE tournament_category_id = _category_id
       AND status = 'jugado'::public.match_status
  ) THEN
    RAISE EXCEPTION 'No se puede reabrir: ya hay partidos jugados';
  END IF;

  DELETE FROM public.tournament_matches WHERE tournament_category_id = _category_id;

  UPDATE public.tournament_categories
     SET bracket_generated_at = NULL,
         status = 'borrador'::public.tournament_status,
         updated_at = now()
   WHERE id = _category_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reopen_category(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_category(uuid) TO authenticated, service_role;

-- 4) Función: marcar dependientes para revisión tras corrección
CREATE OR REPLACE FUNCTION public.flag_dependent_matches_for_review(_corrected_match_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_count integer := 0;
  v_next uuid;
BEGIN
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _corrected_match_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF NOT public.is_tournament_manager(v_match.tournament_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Recorre la cadena de next_match_id mientras estén jugados
  v_next := v_match.next_match_id;
  WHILE v_next IS NOT NULL LOOP
    SELECT * INTO v_match FROM public.tournament_matches WHERE id = v_next;
    EXIT WHEN NOT FOUND;
    IF v_match.status = 'jugado'::public.match_status THEN
      INSERT INTO public.tournament_match_review_flags (tenant_id, tournament_match_id, reason)
      VALUES (v_match.tenant_id, v_match.id, 'Resultado anterior corregido — revisar dependencia')
      ON CONFLICT (tournament_match_id) DO NOTHING;
      v_count := v_count + 1;
      v_next := v_match.next_match_id;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.flag_dependent_matches_for_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flag_dependent_matches_for_review(uuid) TO authenticated, service_role;
