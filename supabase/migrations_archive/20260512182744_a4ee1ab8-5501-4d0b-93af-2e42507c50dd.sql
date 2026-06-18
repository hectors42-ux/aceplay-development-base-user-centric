-- 1) Cancelar desafíos "propuesto" que no tienen propuesta de horarios.
--    Estos son inconsistentes (un desafío sin horarios para ofrecer) y causaron
--    confusión en la UI a usuarios reales.
UPDATE public.ladder_challenges c
SET status = 'cancelado',
    cancel_reason = COALESCE(c.cancel_reason, 'Cancelado automáticamente: desafío sin propuesta de horarios'),
    updated_at = now()
WHERE c.status = 'propuesto'
  AND NOT EXISTS (
    SELECT 1 FROM public.ladder_challenge_schedule_proposals p
    WHERE p.challenge_id = c.id
  );

-- 2) Función de validación: un challenge "propuesto" requiere ≥1 propuesta
--    de horarios. Se ejecuta como CONSTRAINT TRIGGER DEFERRABLE INITIALLY
--    DEFERRED para que los flujos correctos (RPC create_ladder_challenge_with_slots
--    que inserta ambas filas en la misma transacción) sigan funcionando.
CREATE OR REPLACE FUNCTION public.ensure_propuesto_has_schedule_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'propuesto'
     AND NOT EXISTS (
       SELECT 1 FROM public.ladder_challenge_schedule_proposals p
       WHERE p.challenge_id = NEW.id
     )
  THEN
    RAISE EXCEPTION
      'Un desafío en estado "propuesto" debe tener al menos una propuesta de horarios (challenge_id=%).', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_propuesto_has_schedule_proposal ON public.ladder_challenges;
CREATE CONSTRAINT TRIGGER trg_ensure_propuesto_has_schedule_proposal
AFTER INSERT OR UPDATE OF status ON public.ladder_challenges
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.ensure_propuesto_has_schedule_proposal();

-- 3) Helper para tests E2E: inserta atómicamente un desafío "propuesto" junto
--    con su propuesta de horarios mínima, satisfaciendo la nueva regla.
--    Devuelve el id del challenge creado.
CREATE OR REPLACE FUNCTION public._e2e_create_propuesto_challenge(
  _ladder_id uuid,
  _tenant_id uuid,
  _challenger_user_id uuid,
  _challenged_user_id uuid,
  _challenger_position int,
  _challenged_position int,
  _expires_at timestamptz,
  _slot1_starts_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_slot timestamptz := COALESCE(_slot1_starts_at, now() + interval '3 days');
BEGIN
  INSERT INTO public.ladder_challenges (
    ladder_id, tenant_id, challenger_user_id, challenged_user_id,
    challenger_position, challenged_position, status, expires_at
  ) VALUES (
    _ladder_id, _tenant_id, _challenger_user_id, _challenged_user_id,
    _challenger_position, _challenged_position, 'propuesto', _expires_at
  ) RETURNING id INTO v_id;

  INSERT INTO public.ladder_challenge_schedule_proposals (
    challenge_id, tenant_id, proposed_by,
    slot1_starts_at, slot1_court_id
  ) VALUES (
    v_id, _tenant_id, _challenger_user_id,
    v_slot, NULL
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public._e2e_create_propuesto_challenge(
  uuid, uuid, uuid, uuid, int, int, timestamptz, timestamptz
) TO service_role;