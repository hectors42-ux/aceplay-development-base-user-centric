ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS bracket TEXT NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS loser_next_match_id UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loser_next_match_slot CHAR(1);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_bracket_check'
  ) THEN
    ALTER TABLE public.tournament_matches
      ADD CONSTRAINT tournament_matches_bracket_check
      CHECK (bracket IN ('main','plate','winners','losers','grand_final'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_loser_slot_check'
  ) THEN
    ALTER TABLE public.tournament_matches
      ADD CONSTRAINT tournament_matches_loser_slot_check
      CHECK (loser_next_match_slot IS NULL OR loser_next_match_slot IN ('a','b'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_matches_category_bracket
  ON public.tournament_matches(tournament_category_id, bracket, round, bracket_position);

CREATE OR REPLACE FUNCTION public._tg_route_loser()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loser UUID;
BEGIN
  IF NEW.winner_registration_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.winner_registration_id IS NOT DISTINCT FROM NEW.winner_registration_id THEN
    RETURN NEW;
  END IF;
  IF NEW.loser_next_match_id IS NULL OR NEW.loser_next_match_slot IS NULL THEN
    RETURN NEW;
  END IF;

  v_loser := CASE
    WHEN NEW.registration_a_id = NEW.winner_registration_id THEN NEW.registration_b_id
    WHEN NEW.registration_b_id = NEW.winner_registration_id THEN NEW.registration_a_id
    ELSE NULL
  END;

  IF v_loser IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.tournament_matches
  SET registration_a_id = CASE WHEN NEW.loser_next_match_slot = 'a' THEN v_loser ELSE registration_a_id END,
      registration_b_id = CASE WHEN NEW.loser_next_match_slot = 'b' THEN v_loser ELSE registration_b_id END
  WHERE id = NEW.loser_next_match_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_loser ON public.tournament_matches;
CREATE TRIGGER trg_route_loser
  AFTER UPDATE OF winner_registration_id ON public.tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION public._tg_route_loser();