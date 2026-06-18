DO $$
BEGIN
  DELETE FROM tournament_match_results;
  DELETE FROM tournament_match_review_flags;
  DELETE FROM tournament_match_reschedule_requests;
  DELETE FROM americano_rounds;
  DELETE FROM tournament_matches;
  DELETE FROM tournament_groups;
  DELETE FROM tournament_phases;
  DELETE FROM tournament_courts;
  DELETE FROM tournament_registrations;
  DELETE FROM tournament_alerts;
  DELETE FROM tournament_categories;
  DELETE FROM tournaments;

  DELETE FROM match_post_responses;
  DELETE FROM match_open_post_slots;
  DELETE FROM match_open_posts;
  DELETE FROM match_invitations;
  DELETE FROM partner_match_results;
  DELETE FROM match_of_the_week;
  DELETE FROM suggested_matchup_of_the_week;
  DELETE FROM match_observation_outbox;

  DELETE FROM ladder_challenge_schedule_proposals;
  DELETE FROM ladder_challenges;
  DELETE FROM ladder_history;
  DELETE FROM user_challenge_streaks;

  DELETE FROM rating_history;
  DELETE FROM standings_snapshots;
  DELETE FROM player_ratings;

  DELETE FROM bookings;
  DELETE FROM notification_dismissals;
  DELETE FROM user_notifications;
END $$;