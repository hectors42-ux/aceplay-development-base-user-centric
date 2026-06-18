CREATE OR REPLACE FUNCTION public._e2e_reset_padel_ladder()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ladder uuid := 'ef5be00b-b833-4027-b2b3-eb8fdc9bb63c';
BEGIN
  DELETE FROM ladder_challenge_schedule_proposals
   WHERE challenge_id IN (SELECT id FROM ladder_challenges WHERE ladder_id=v_ladder);
  DELETE FROM ladder_history WHERE ladder_id=v_ladder;
  DELETE FROM ladder_challenges WHERE ladder_id=v_ladder;
  -- Restaurar posiciones iniciales
  UPDATE ladder_positions SET position=1, wins=0, losses=0, last_played_at=NULL, last_challenged_at=NULL WHERE ladder_id=v_ladder AND user_id='e04b6339-6dbc-4bec-9656-9740d4b77dbf';
  UPDATE ladder_positions SET position=2, wins=0, losses=0, last_played_at=NULL, last_challenged_at=NULL WHERE ladder_id=v_ladder AND user_id='afdfa252-f446-435b-bbf2-237f4da03376';
  UPDATE ladder_positions SET position=3, wins=0, losses=0, last_played_at=NULL, last_challenged_at=NULL WHERE ladder_id=v_ladder AND user_id='d8162e3e-3928-4de5-a97e-8a32a8ded2af';
  UPDATE ladder_positions SET position=4, wins=0, losses=0, last_played_at=NULL, last_challenged_at=NULL WHERE ladder_id=v_ladder AND user_id='e1b1724e-71f4-455b-9482-350ef950fdc8';
  UPDATE ladder_positions SET position=5, wins=0, losses=0, last_played_at=NULL, last_challenged_at=NULL WHERE ladder_id=v_ladder AND user_id='e817e629-ac4f-4f17-be8e-13eed3928072';
  UPDATE ladder_positions SET position=6, wins=0, losses=0, last_played_at=NULL, last_challenged_at=NULL WHERE ladder_id=v_ladder AND user_id='ccd4a6d9-9216-40fa-a4c3-3bb49839b9de';
END $$;
REVOKE ALL ON FUNCTION public._e2e_reset_padel_ladder() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._e2e_reset_padel_ladder() TO service_role;