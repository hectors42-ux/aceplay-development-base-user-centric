-- 1) Limpieza: cancelar challenges propuesto sin propuestas válidas
UPDATE public.ladder_challenges c
SET status = 'cancelado',
    cancel_reason = COALESCE(cancel_reason, 'auto: propuesta de horario incompleta')
WHERE c.status = 'propuesto'
  AND NOT EXISTS (
    SELECT 1 FROM public.ladder_challenge_schedule_proposals p
    WHERE p.challenge_id = c.id
      AND p.slot1_starts_at IS NOT NULL
      AND p.slot1_court_id IS NOT NULL
  );

-- 2) Trigger en schedule_proposals: bloquea DELETE/UPDATE que dejaría
--    a un challenge 'propuesto' sin slot1 (starts_at + court_id)
CREATE OR REPLACE FUNCTION public.ensure_proposal_keeps_propuesto_valid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status ladder_challenge_status;
  v_remaining int;
BEGIN
  SELECT status INTO v_status
  FROM public.ladder_challenges
  WHERE id = COALESCE(OLD.challenge_id, NEW.challenge_id);

  IF v_status IS NULL OR v_status <> 'propuesto' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT count(*) INTO v_remaining
  FROM public.ladder_challenge_schedule_proposals
  WHERE challenge_id = COALESCE(OLD.challenge_id, NEW.challenge_id)
    AND slot1_starts_at IS NOT NULL
    AND slot1_court_id IS NOT NULL
    AND (TG_OP <> 'DELETE' OR id <> OLD.id);

  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'Un desafío en estado "propuesto" no puede quedar sin propuesta de horario válida (challenge_id=%)',
      COALESCE(OLD.challenge_id, NEW.challenge_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_proposal_keeps_propuesto_valid ON public.ladder_challenge_schedule_proposals;

CREATE CONSTRAINT TRIGGER trg_proposal_keeps_propuesto_valid
AFTER DELETE OR UPDATE OF slot1_starts_at, slot1_court_id, challenge_id
ON public.ladder_challenge_schedule_proposals
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.ensure_proposal_keeps_propuesto_valid();