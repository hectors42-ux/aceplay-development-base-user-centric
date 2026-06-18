DO $$
DECLARE v_user uuid; v_tenant uuid;
BEGIN
  SELECT user_id, tenant_id INTO v_user, v_tenant FROM public.profiles WHERE email = 'sergiorodriguez@aceplay.cl';
  IF NOT EXISTS (SELECT 1 FROM public.player_ratings WHERE user_id = v_user AND sport = 'tenis_singles') THEN
    INSERT INTO public.player_ratings (tenant_id, user_id, sport, level, reliability, initial_level, onboarding_completed_at)
    VALUES (v_tenant, v_user, 'tenis_singles', 5.50, 80, 5.50, now());
  ELSE
    UPDATE public.player_ratings SET onboarding_completed_at = COALESCE(onboarding_completed_at, now())
    WHERE user_id = v_user AND sport = 'tenis_singles';
  END IF;
END $$;