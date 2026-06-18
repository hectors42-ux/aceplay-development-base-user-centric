
-- ============================================================
-- 1. consecutive_wins en tournament_registrations
-- ============================================================
ALTER TABLE public.tournament_registrations
  ADD COLUMN IF NOT EXISTS consecutive_wins integer NOT NULL DEFAULT 0;

-- Trigger: cuando un match pasa a 'jugado' con un winner, sumamos racha al
-- ganador y reseteamos al perdedor. Se ejecuta UNA sola vez por transición.
CREATE OR REPLACE FUNCTION public.update_consecutive_wins_on_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  loser_reg_id uuid;
BEGIN
  -- Solo si pasa a 'jugado' con winner (no aplica a walkover/cancelado)
  IF NEW.status = 'jugado' AND NEW.winner_registration_id IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR OLD.status IS DISTINCT FROM NEW.status
          OR OLD.winner_registration_id IS DISTINCT FROM NEW.winner_registration_id)
  THEN
    -- Identificar al perdedor
    IF NEW.registration_a_id = NEW.winner_registration_id THEN
      loser_reg_id := NEW.registration_b_id;
    ELSE
      loser_reg_id := NEW.registration_a_id;
    END IF;

    -- Incrementar racha del ganador
    UPDATE public.tournament_registrations
       SET consecutive_wins = consecutive_wins + 1
     WHERE id = NEW.winner_registration_id;

    -- Resetear racha del perdedor
    IF loser_reg_id IS NOT NULL THEN
      UPDATE public.tournament_registrations
         SET consecutive_wins = 0
       WHERE id = loser_reg_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_consecutive_wins ON public.tournament_matches;
CREATE TRIGGER trg_update_consecutive_wins
  AFTER INSERT OR UPDATE OF status, winner_registration_id
  ON public.tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_consecutive_wins_on_match();

-- ============================================================
-- 2. standings_snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS public.standings_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.tournament_categories(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.tournament_registrations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position integer NOT NULL,
  points numeric NOT NULL DEFAULT 0,
  consecutive_wins integer NOT NULL DEFAULT 0,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  snapshot_date date GENERATED ALWAYS AS (((snapshot_at AT TIME ZONE 'America/Santiago')::date)) STORED,
  UNIQUE (category_id, user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_standings_snapshots_category_date
  ON public.standings_snapshots (category_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_standings_snapshots_user_date
  ON public.standings_snapshots (user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_standings_snapshots_tournament
  ON public.standings_snapshots (tournament_id, snapshot_date DESC);

GRANT SELECT ON public.standings_snapshots TO authenticated;
GRANT ALL ON public.standings_snapshots TO service_role;

ALTER TABLE public.standings_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven snapshots de su club"
  ON public.standings_snapshots
  FOR SELECT
  TO authenticated
  USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- ============================================================
-- 3. snapshot_tournament_standings()
-- ============================================================
CREATE OR REPLACE FUNCTION public.snapshot_tournament_standings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  WITH active_cats AS (
    SELECT tc.id AS category_id, tc.tournament_id, t.tenant_id
      FROM public.tournament_categories tc
      JOIN public.tournaments t ON t.id = tc.tournament_id
     WHERE t.status IN ('inscripciones_abiertas','inscripciones_cerradas','en_curso')
  ),
  ins AS (
    INSERT INTO public.standings_snapshots
      (tenant_id, tournament_id, category_id, registration_id, user_id, position, points, consecutive_wins)
    SELECT
      ac.tenant_id,
      ac.tournament_id,
      ac.category_id,
      r.id,
      p.user_id,
      COALESCE(s.position, 9999),
      COALESCE(s.total_points, 0),
      COALESCE(r.consecutive_wins, 0)
    FROM active_cats ac
    JOIN public.tournament_registrations r
      ON r.tournament_category_id = ac.category_id
     AND r.status = 'confirmada'
    LEFT JOIN public.round_robin_standings s
      ON s.registration_id = r.id
    CROSS JOIN LATERAL (
      VALUES (r.player1_user_id), (r.player2_user_id)
    ) AS p(user_id)
    WHERE p.user_id IS NOT NULL
    ON CONFLICT (category_id, user_id, snapshot_date) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO inserted_count FROM ins;
  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.snapshot_tournament_standings() TO service_role;
