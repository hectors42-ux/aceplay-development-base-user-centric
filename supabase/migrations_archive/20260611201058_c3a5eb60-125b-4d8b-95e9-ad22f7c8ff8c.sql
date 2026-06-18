
-- Tabla de grupos
CREATE TABLE public.tournament_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  tournament_category_id uuid NOT NULL REFERENCES public.tournament_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_groups TO authenticated;
GRANT ALL ON public.tournament_groups TO service_role;

ALTER TABLE public.tournament_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros del tenant ven grupos"
  ON public.tournament_groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.tenant_id = tournament_groups.tenant_id
    )
  );

CREATE POLICY "Admins gestionan grupos"
  ON public.tournament_groups FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournament_categories tc
      JOIN public.tournaments t ON t.id = tc.tournament_id
      WHERE tc.id = tournament_groups.tournament_category_id
        AND public.is_tournament_manager(t.id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournament_categories tc
      JOIN public.tournaments t ON t.id = tc.tournament_id
      WHERE tc.id = tournament_groups.tournament_category_id
        AND public.is_tournament_manager(t.id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_tournament_groups_category
  ON public.tournament_groups(tournament_category_id, sort_order);

-- Columnas en tournament_matches
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS tournament_group_id uuid
    REFERENCES public.tournament_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phase text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_phase_check'
  ) THEN
    ALTER TABLE public.tournament_matches
      ADD CONSTRAINT tournament_matches_phase_check
      CHECK (phase IS NULL OR phase IN ('grupos','playoff'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tournament_matches_phase
  ON public.tournament_matches(tournament_category_id, phase);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_group
  ON public.tournament_matches(tournament_group_id);

-- Columnas en tournament_categories
ALTER TABLE public.tournament_categories
  ADD COLUMN IF NOT EXISTS groups_count int,
  ADD COLUMN IF NOT EXISTS qualifiers_per_group int NOT NULL DEFAULT 2;
