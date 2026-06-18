-- Delete all simulated/bot users (auth + profile + dependencies)
-- Keeps only real humans: demouser@aceplay.cl and hector.smith@aceplay.cl
DO $$
DECLARE
  v_bot_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_bot_ids
  FROM auth.users
  WHERE email LIKE '%@aceplay.test';

  IF v_bot_ids IS NULL OR array_length(v_bot_ids, 1) = 0 THEN
    RAISE NOTICE 'No bot users found';
    RETURN;
  END IF;

  RAISE NOTICE 'Deleting % bot users and their data', array_length(v_bot_ids, 1);

  -- Defensive cleanup of tables that may not cascade
  DELETE FROM public.user_notifications WHERE user_id = ANY(v_bot_ids);
  DELETE FROM public.notification_dismissals WHERE user_id = ANY(v_bot_ids);
  DELETE FROM public.user_badges WHERE user_id = ANY(v_bot_ids);
  DELETE FROM public.user_challenge_streaks WHERE user_id = ANY(v_bot_ids);
  DELETE FROM public.user_availability WHERE user_id = ANY(v_bot_ids);
  DELETE FROM public.match_search_filters WHERE user_id = ANY(v_bot_ids);
  DELETE FROM public.player_ratings WHERE user_id = ANY(v_bot_ids);
  DELETE FROM public.ladder_positions WHERE user_id = ANY(v_bot_ids);
  DELETE FROM public.user_roles WHERE user_id = ANY(v_bot_ids);
  DELETE FROM public.profiles WHERE user_id = ANY(v_bot_ids);

  -- Finally delete auth users
  DELETE FROM auth.users WHERE id = ANY(v_bot_ids);
END $$;