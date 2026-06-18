
-- 1) Fix gamification trigger: avoid duplicate key on user_badges
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
BEGIN
  SELECT * INTO _streak FROM user_challenge_streaks
  WHERE tenant_id = NEW.tenant_id AND user_id = NEW.challenger_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_challenge_streaks
      (tenant_id, user_id, current_streak, longest_streak, last_week_start, last_challenge_at)
    VALUES (NEW.tenant_id, NEW.challenger_user_id, 1, 1, _week_start, now());
    _new_current := 1;
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
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM ladder_challenges c
    WHERE c.challenger_user_id = NEW.challenger_user_id
      AND c.tenant_id = NEW.tenant_id
      AND c.id <> NEW.id
      AND date_trunc('month', c.created_at) = date_trunc('month', NEW.created_at)
  ) INTO _first_this_month;

  IF _first_this_month THEN
    SELECT id INTO _badge_id FROM badges WHERE code = 'retador_activo';
    IF _badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM user_badges
      WHERE user_id = NEW.challenger_user_id
        AND tenant_id = NEW.tenant_id
        AND badge_id = _badge_id
    ) THEN
      INSERT INTO user_badges (tenant_id, user_id, badge_id, context)
      VALUES (NEW.tenant_id, NEW.challenger_user_id, _badge_id,
              jsonb_build_object('challenge_id', NEW.id, 'month', to_char(NEW.created_at, 'YYYY-MM')))
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END IF;

  IF _new_current >= 3 THEN
    SELECT id INTO _badge_id FROM badges WHERE code = 'racha_3_semanas';
    IF _badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM user_badges
      WHERE user_id = NEW.challenger_user_id
        AND tenant_id = NEW.tenant_id
        AND badge_id = _badge_id
    ) THEN
      INSERT INTO user_badges (tenant_id, user_id, badge_id, context)
      VALUES (NEW.tenant_id, NEW.challenger_user_id, _badge_id,
              jsonb_build_object('streak', _new_current))
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Enable realtime for ladder + tournament tables so notifications fire instantly
ALTER TABLE public.ladder_challenges REPLICA IDENTITY FULL;
ALTER TABLE public.ladder_challenge_schedule_proposals REPLICA IDENTITY FULL;
ALTER TABLE public.tournament_matches REPLICA IDENTITY FULL;
ALTER TABLE public.tournament_match_results REPLICA IDENTITY FULL;
ALTER TABLE public.tournament_match_reschedule_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ladder_challenges; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ladder_challenge_schedule_proposals; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_match_results; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_match_reschedule_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
