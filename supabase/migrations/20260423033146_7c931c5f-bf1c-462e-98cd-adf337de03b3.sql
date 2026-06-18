-- Add RAISE NOTICE traces to create_ladder_challenge and handle_challenge_gamification
-- to debug badge awarding flow.

CREATE OR REPLACE FUNCTION public.create_ladder_challenge(_ladder_id uuid, _challenged_user_id uuid)
 RETURNS public.ladder_challenges
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_ladder public.ladders%ROWTYPE;
  v_challenger_pos public.ladder_positions%ROWTYPE;
  v_challenged_pos public.ladder_positions%ROWTYPE;
  v_dues public.dues_status;
  v_last_match TIMESTAMPTZ;
  v_challenge public.ladder_challenges%ROWTYPE;
BEGIN
  RAISE NOTICE '[create_ladder_challenge] start: challenger=% challenged=% ladder=%',
    v_user_id, _challenged_user_id, _ladder_id;

  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _challenged_user_id = v_user_id THEN
    RAISE EXCEPTION 'No puedes desafiarte a ti mismo';
  END IF;

  SELECT * INTO v_ladder FROM public.ladders WHERE id = _ladder_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La pirámide no existe'; END IF;
  IF NOT v_ladder.is_active THEN RAISE EXCEPTION 'La pirámide no está activa'; END IF;

  SELECT dues_status INTO v_dues FROM public.profiles WHERE user_id = v_user_id;
  IF v_dues IN ('moroso','suspendido') THEN
    RAISE EXCEPTION 'No puedes desafiar: cuotas %', v_dues;
  END IF;

  SELECT * INTO v_challenger_pos
  FROM public.ladder_positions
  WHERE ladder_id = _ladder_id AND user_id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No estás inscrito en esta pirámide'; END IF;
  IF v_challenger_pos.status <> 'activo' THEN
    RAISE EXCEPTION 'Tu posición está % en la pirámide', v_challenger_pos.status;
  END IF;

  SELECT * INTO v_challenged_pos
  FROM public.ladder_positions
  WHERE ladder_id = _ladder_id AND user_id = _challenged_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El rival no está inscrito en esta pirámide'; END IF;
  IF v_challenged_pos.status <> 'activo' THEN
    RAISE EXCEPTION 'El rival está % en la pirámide', v_challenged_pos.status;
  END IF;

  IF v_challenged_pos.position >= v_challenger_pos.position THEN
    RAISE EXCEPTION 'Solo puedes desafiar a jugadores en mejor posición';
  END IF;

  IF (v_challenger_pos.position - v_challenged_pos.position) > v_ladder.max_position_jump THEN
    RAISE EXCEPTION 'Máximo % puestos de salto. El rival está a % puestos arriba.',
      v_ladder.max_position_jump,
      (v_challenger_pos.position - v_challenged_pos.position);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ladder_challenges
    WHERE ladder_id = _ladder_id
      AND status IN ('propuesto','aceptado','programado')
      AND (
        (challenger_user_id = v_user_id AND challenged_user_id = _challenged_user_id)
        OR (challenger_user_id = _challenged_user_id AND challenged_user_id = v_user_id)
      )
  ) THEN
    RAISE EXCEPTION 'Ya existe un desafío activo entre ustedes';
  END IF;

  SELECT MAX(played_at) INTO v_last_match
  FROM public.ladder_challenges
  WHERE ladder_id = _ladder_id
    AND status = 'jugado'
    AND played_at IS NOT NULL
    AND (
      (challenger_user_id = v_user_id AND challenged_user_id = _challenged_user_id)
      OR (challenger_user_id = _challenged_user_id AND challenged_user_id = v_user_id)
    );

  IF v_last_match IS NOT NULL
     AND v_last_match + (v_ladder.cooldown_days || ' days')::INTERVAL > now() THEN
    RAISE EXCEPTION 'Debes esperar % días entre desafíos al mismo rival. Disponible desde: %',
      v_ladder.cooldown_days,
      to_char(v_last_match + (v_ladder.cooldown_days || ' days')::INTERVAL, 'DD-MM-YYYY HH24:MI');
  END IF;

  RAISE NOTICE '[create_ladder_challenge] validations passed, inserting challenge row';

  INSERT INTO public.ladder_challenges (
    ladder_id, tenant_id,
    challenger_user_id, challenged_user_id,
    challenger_position, challenged_position,
    status, expires_at
  ) VALUES (
    _ladder_id, v_ladder.tenant_id,
    v_user_id, _challenged_user_id,
    v_challenger_pos.position, v_challenged_pos.position,
    'propuesto',
    now() + (v_ladder.response_window_hours || ' hours')::INTERVAL
  ) RETURNING * INTO v_challenge;

  RAISE NOTICE '[create_ladder_challenge] inserted challenge id=%', v_challenge.id;

  UPDATE public.ladder_positions
  SET last_challenged_at = now()
  WHERE id = v_challenger_pos.id;

  RAISE NOTICE '[create_ladder_challenge] done id=%', v_challenge.id;
  RETURN v_challenge;
END;
$function$;


CREATE OR REPLACE FUNCTION public.handle_challenge_gamification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _week_start date := date_trunc('week', now())::date;
  _streak user_challenge_streaks%ROWTYPE;
  _new_current integer := 1;
  _badge_id uuid;
  _first_this_month boolean;
  _existing_count integer;
  _inserted_count integer;
BEGIN
  RAISE NOTICE '[gamification] trigger start challenge=% challenger=% tenant=%',
    NEW.id, NEW.challenger_user_id, NEW.tenant_id;

  SELECT * INTO _streak FROM user_challenge_streaks
  WHERE tenant_id = NEW.tenant_id AND user_id = NEW.challenger_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_challenge_streaks
      (tenant_id, user_id, current_streak, longest_streak, last_week_start, last_challenge_at)
    VALUES (NEW.tenant_id, NEW.challenger_user_id, 1, 1, _week_start, now());
    _new_current := 1;
    RAISE NOTICE '[gamification] streak created current=1';
  ELSE
    IF _streak.last_week_start = _week_start THEN
      _new_current := _streak.current_streak;
    ELSIF _streak.last_week_start = (_week_start - interval '7 days')::date THEN
      _new_current := _streak.current_streak + 1;
    ELSE
      _new_current := 1;
    END IF;
    UPDATE user_challenge_streaks
    SET current_streak = _new_current,
        longest_streak = GREATEST(longest_streak, _new_current),
        last_week_start = _week_start,
        last_challenge_at = now(),
        updated_at = now()
    WHERE id = _streak.id;
    RAISE NOTICE '[gamification] streak updated current=% prev_week=%',
      _new_current, _streak.last_week_start;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM ladder_challenges c
    WHERE c.challenger_user_id = NEW.challenger_user_id
      AND c.tenant_id = NEW.tenant_id
      AND c.id <> NEW.id
      AND date_trunc('month', c.created_at) = date_trunc('month', NEW.created_at)
  ) INTO _first_this_month;

  RAISE NOTICE '[gamification] first_this_month=% (month=%)',
    _first_this_month, to_char(NEW.created_at, 'YYYY-MM');

  IF _first_this_month THEN
    SELECT id INTO _badge_id FROM badges WHERE code = 'retador_activo';
    IF _badge_id IS NULL THEN
      RAISE NOTICE '[gamification] badge "retador_activo" NOT FOUND in catalog, skipping';
    ELSE
      SELECT count(*) INTO _existing_count FROM user_badges
      WHERE user_id = NEW.challenger_user_id
        AND tenant_id = NEW.tenant_id
        AND badge_id = _badge_id;

      IF _existing_count > 0 THEN
        RAISE NOTICE '[gamification] retador_activo already held by user (count=%), skipping insert',
          _existing_count;
      ELSE
        RAISE NOTICE '[gamification] attempting INSERT retador_activo for user=%',
          NEW.challenger_user_id;
        INSERT INTO user_badges (tenant_id, user_id, badge_id, context)
        VALUES (NEW.tenant_id, NEW.challenger_user_id, _badge_id,
                jsonb_build_object('challenge_id', NEW.id, 'month', to_char(NEW.created_at, 'YYYY-MM')))
        ON CONFLICT (user_id, badge_id) DO NOTHING;
        GET DIAGNOSTICS _inserted_count = ROW_COUNT;
        IF _inserted_count = 0 THEN
          RAISE NOTICE '[gamification] retador_activo INSERT skipped by ON CONFLICT (race or duplicate)';
        ELSE
          RAISE NOTICE '[gamification] retador_activo awarded successfully';
        END IF;
      END IF;
    END IF;
  END IF;

  IF _new_current >= 3 THEN
    SELECT id INTO _badge_id FROM badges WHERE code = 'racha_3_semanas';
    IF _badge_id IS NULL THEN
      RAISE NOTICE '[gamification] badge "racha_3_semanas" NOT FOUND, skipping';
    ELSE
      SELECT count(*) INTO _existing_count FROM user_badges
      WHERE user_id = NEW.challenger_user_id
        AND tenant_id = NEW.tenant_id
        AND badge_id = _badge_id;

      IF _existing_count > 0 THEN
        RAISE NOTICE '[gamification] racha_3_semanas already held (count=%), skipping',
          _existing_count;
      ELSE
        RAISE NOTICE '[gamification] attempting INSERT racha_3_semanas streak=%', _new_current;
        INSERT INTO user_badges (tenant_id, user_id, badge_id, context)
        VALUES (NEW.tenant_id, NEW.challenger_user_id, _badge_id,
                jsonb_build_object('streak', _new_current))
        ON CONFLICT (user_id, badge_id) DO NOTHING;
        GET DIAGNOSTICS _inserted_count = ROW_COUNT;
        IF _inserted_count = 0 THEN
          RAISE NOTICE '[gamification] racha_3_semanas INSERT skipped by ON CONFLICT';
        ELSE
          RAISE NOTICE '[gamification] racha_3_semanas awarded';
        END IF;
      END IF;
    END IF;
  END IF;

  RAISE NOTICE '[gamification] trigger end challenge=%', NEW.id;
  RETURN NEW;
END;
$function$;