
-- Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions
-- that are not part of the user-facing API (triggers, cron targets,
-- internal "_apply_*" helpers, gamification, notify_* triggers,
-- compute_* server-side jobs, and the e2e _create_propuesto_challenge
-- helper which was incorrectly exposed).
--
-- Functions remain callable by service_role (edge functions, admin code)
-- and by Postgres internal trigger machinery (which runs as table owner).

DO $$
DECLARE
  fn record;
  patterns text[] := ARRAY[
    -- internal apply helpers
    '_apply_ladder_result', '_apply_match_result',
    '_apply_partner_match_rating', '_apply_rating_for_match',
    'recalculate_rating_after_match',
    -- e2e helper exposed by mistake
    '_e2e_create_propuesto_challenge',
    -- trigger functions
    '_tg_rating_on_ladder_challenge', '_tg_rating_on_tournament_match',
    'handle_new_user', 'handle_challenge_gamification',
    'ensure_proposal_keeps_propuesto_valid',
    'ensure_propuesto_has_schedule_proposal',
    'expire_match_invitations',
    'notify_match_invitation_booking',
    'notify_match_invitation_cancelled',
    'notify_match_invitation_created',
    'notify_match_invitation_response',
    'notify_tournament_match_scheduled',
    'notify_tournament_status_change',
    -- cron-target functions (invoked via service_role from edge functions)
    'process_ladder_expirations_run',
    'process_ladder_inactivity_run',
    'enqueue_partner_match_reminders',
    -- server-side scheduled computations
    'compute_match_of_the_week',
    'compute_suggested_matchup',
    -- bootstrap helpers (run once at tenant creation, then idle)
    'create_default_booking_rules',
    -- guard used only inside analytics_* (still kept public for those wrappers)
    -- intentionally NOT revoking _analytics_guard since analytics_* depend on it
    -- and analytics_* themselves validate role
    -- _analytics_guard
    NULL
  ];
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname = ANY (patterns)
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      fn.proname, fn.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
      fn.proname, fn.args
    );
  END LOOP;
END $$;
