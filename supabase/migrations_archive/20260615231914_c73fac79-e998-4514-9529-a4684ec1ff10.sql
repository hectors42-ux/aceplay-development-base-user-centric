-- 1. tournament_rules table
CREATE TABLE public.tournament_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  descriptive_md text,
  format_table_json jsonb,
  key_rules_md text,
  tiebreak_rules_md text,
  player_guide_md text,
  operator_guide_md text,
  image_rights_md text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (tournament_id, version)
);

CREATE UNIQUE INDEX tournament_rules_current_uniq
  ON public.tournament_rules (tournament_id)
  WHERE is_current = true;

GRANT SELECT ON public.tournament_rules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tournament_rules TO authenticated;
GRANT ALL ON public.tournament_rules TO service_role;

ALTER TABLE public.tournament_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rules public read"
  ON public.tournament_rules
  FOR SELECT
  USING (true);

CREATE POLICY "rules manager write"
  ON public.tournament_rules
  FOR ALL
  TO authenticated
  USING (public.is_tournament_manager(tournament_id))
  WITH CHECK (public.is_tournament_manager(tournament_id));

CREATE TRIGGER tournament_rules_updated_at
  BEFORE UPDATE ON public.tournament_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. tournament_registrations acceptance columns
ALTER TABLE public.tournament_registrations
  ADD COLUMN IF NOT EXISTS rules_version_accepted int,
  ADD COLUMN IF NOT EXISTS rules_accepted_at timestamptz;

-- 3. RPC to publish a new version atomically
CREATE OR REPLACE FUNCTION public.publish_tournament_rules(
  _tournament_id uuid,
  _payload jsonb
)
RETURNS public.tournament_rules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next_version int;
  _row public.tournament_rules;
BEGIN
  IF NOT public.is_tournament_manager(_tournament_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.tournament_rules
    SET is_current = false
    WHERE tournament_id = _tournament_id AND is_current = true;

  SELECT COALESCE(MAX(version), 0) + 1 INTO _next_version
    FROM public.tournament_rules
    WHERE tournament_id = _tournament_id;

  INSERT INTO public.tournament_rules (
    tournament_id, version, is_current,
    descriptive_md, format_table_json,
    key_rules_md, tiebreak_rules_md,
    player_guide_md, operator_guide_md,
    image_rights_md, created_by
  ) VALUES (
    _tournament_id, _next_version, true,
    _payload->>'descriptive_md',
    _payload->'format_table_json',
    _payload->>'key_rules_md',
    _payload->>'tiebreak_rules_md',
    _payload->>'player_guide_md',
    _payload->>'operator_guide_md',
    _payload->>'image_rights_md',
    auth.uid()
  )
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_tournament_rules(uuid, jsonb) TO authenticated;