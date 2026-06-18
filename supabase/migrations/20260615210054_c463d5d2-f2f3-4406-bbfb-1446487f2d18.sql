
CREATE TABLE public.tournament_cobrand (
  tournament_id uuid PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  brand_key text NOT NULL,
  display_name text NOT NULL,
  eyebrow_text text,
  lockup_text text,
  flag_country text,
  logo_url text,
  rights_text text,
  primary_hex text,
  accent_hex text,
  gradient_css text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tournament_cobrand TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tournament_cobrand TO authenticated;
GRANT ALL ON public.tournament_cobrand TO service_role;

ALTER TABLE public.tournament_cobrand ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cobrand visible para todos"
  ON public.tournament_cobrand
  FOR SELECT
  USING (true);

CREATE POLICY "Organizador gestiona cobrand"
  ON public.tournament_cobrand
  FOR ALL
  TO authenticated
  USING (public.is_tournament_manager(tournament_id))
  WITH CHECK (public.is_tournament_manager(tournament_id));

CREATE TRIGGER update_tournament_cobrand_updated_at
  BEFORE UPDATE ON public.tournament_cobrand
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_cobrand;
