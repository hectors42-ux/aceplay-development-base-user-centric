INSERT INTO public.player_ratings (user_id, tenant_id, sport, level, reliability, onboarding_completed_at)
SELECT cp.user_id, cp.tenant_id, 'tenis_singles'::rating_sport, 0, 15, now()
FROM public.coach_profiles cp
WHERE NOT EXISTS (
  SELECT 1 FROM public.player_ratings pr
  WHERE pr.user_id = cp.user_id AND pr.sport = 'tenis_singles'
);

UPDATE public.player_ratings pr
SET onboarding_completed_at = COALESCE(pr.onboarding_completed_at, now())
FROM public.coach_profiles cp
WHERE pr.user_id = cp.user_id
  AND pr.sport = 'tenis_singles'
  AND pr.onboarding_completed_at IS NULL;