CREATE OR REPLACE FUNCTION public._e2e_create_propuesto_challenge(
  _ladder_id uuid, _tenant_id uuid, _challenger_user_id uuid, _challenged_user_id uuid,
  _challenger_position integer, _challenged_position integer,
  _expires_at timestamp with time zone,
  _slot1_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_slot timestamptz := COALESCE(_slot1_starts_at, now() + interval '3 days');
  v_court uuid;
BEGIN
  SELECT id INTO v_court FROM public.courts
   WHERE tenant_id = _tenant_id
   ORDER BY created_at ASC NULLS LAST
   LIMIT 1;
  IF v_court IS NULL THEN
    RAISE EXCEPTION 'No hay canchas disponibles para tenant %', _tenant_id;
  END IF;

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
    v_slot, v_court
  );

  RETURN v_id;
END;
$function$;