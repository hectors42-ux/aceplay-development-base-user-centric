CREATE OR REPLACE FUNCTION public.process_ladder_expirations_run()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _ch RECORD;
  _challenger_name TEXT;
  _challenged_name TEXT;
  _ladder_name TEXT;
  _walkovers INT := 0;
  _expired INT := 0;
BEGIN
  -- 1) 'propuesto' expirado → walkover automático para el retador
  FOR _ch IN
    SELECT * FROM public.ladder_challenges
    WHERE status = 'propuesto'
      AND expires_at < now()
    FOR UPDATE
  LOOP
    SELECT (first_name || ' ' || last_name) INTO _challenger_name
      FROM public.profiles WHERE user_id = _ch.challenger_user_id;
    SELECT (first_name || ' ' || last_name) INTO _challenged_name
      FROM public.profiles WHERE user_id = _ch.challenged_user_id;
    SELECT name INTO _ladder_name FROM public.ladders WHERE id = _ch.ladder_id;

    UPDATE public.ladder_challenges
       SET status = 'jugado',
           walkover = true,
           winner_user_id = _ch.challenger_user_id,
           loser_user_id = _ch.challenged_user_id,
           played_at = now(),
           result_confirmed_at = now(),
           responded_at = COALESCE(responded_at, now()),
           cancel_reason = COALESCE(cancel_reason, 'auto_walkover_no_respuesta'),
           updated_at = now()
     WHERE id = _ch.id;

    -- aplica swap + history (reason='walkover')
    PERFORM public._apply_ladder_result(_ch.id);

    INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, description, link, ref_id)
    VALUES
      (_ch.tenant_id, _ch.challenger_user_id, 'challenge_walkover',
       'Ganaste por walkover',
       COALESCE(_challenged_name, 'Tu rival') || ' no respondió a tiempo en ' || COALESCE(_ladder_name, 'la pirámide'),
       '/ranking?tab=piramide', _ch.id),
      (_ch.tenant_id, _ch.challenged_user_id, 'challenge_walkover',
       'Perdiste por walkover',
       'No respondiste a tiempo el desafío de ' || COALESCE(_challenger_name, 'un jugador') || ' en ' || COALESCE(_ladder_name, 'la pirámide'),
       '/ranking?tab=piramide', _ch.id);

    _walkovers := _walkovers + 1;
  END LOOP;

  -- 2) 'aceptado'/'programado' expirado sin resultado → expirar y notificar
  FOR _ch IN
    SELECT * FROM public.ladder_challenges
    WHERE status IN ('aceptado','programado')
      AND expires_at < now()
  LOOP
    SELECT (first_name || ' ' || last_name) INTO _challenger_name
      FROM public.profiles WHERE user_id = _ch.challenger_user_id;
    SELECT (first_name || ' ' || last_name) INTO _challenged_name
      FROM public.profiles WHERE user_id = _ch.challenged_user_id;
    SELECT name INTO _ladder_name FROM public.ladders WHERE id = _ch.ladder_id;

    INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, description, link, ref_id)
    VALUES
      (_ch.tenant_id, _ch.challenger_user_id, 'challenge_expired',
       'Tu desafío expiró sin jugarse',
       'No se cargó resultado del partido vs ' || COALESCE(_challenged_name, 'tu rival') || ' en ' || COALESCE(_ladder_name, 'la pirámide'),
       '/ranking?tab=piramide', _ch.id),
      (_ch.tenant_id, _ch.challenged_user_id, 'challenge_expired',
       'Un desafío expiró sin jugarse',
       'No se cargó resultado del partido vs ' || COALESCE(_challenger_name, 'un jugador') || ' en ' || COALESCE(_ladder_name, 'la pirámide'),
       '/ranking?tab=piramide', _ch.id);

    DELETE FROM public.ladder_challenge_schedule_proposals WHERE challenge_id = _ch.id;
    DELETE FROM public.ladder_challenges WHERE id = _ch.id;
    _expired := _expired + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'auto_walkovers', _walkovers,
    'expired_deleted', _expired,
    'ran_at', now()
  );
END;
$function$;