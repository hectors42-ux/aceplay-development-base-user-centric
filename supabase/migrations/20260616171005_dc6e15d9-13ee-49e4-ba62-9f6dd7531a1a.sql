-- 1. Flag
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS is_public_stream_enabled boolean NOT NULL DEFAULT false;

-- 2. Featured match table
CREATE TABLE IF NOT EXISTS public.tournament_stream_featured (
  tournament_id uuid PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now(),
  set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_stream_featured TO authenticated;
GRANT ALL ON public.tournament_stream_featured TO service_role;

ALTER TABLE public.tournament_stream_featured ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers and operators manage featured"
  ON public.tournament_stream_featured FOR ALL TO authenticated
  USING (
    public.is_tournament_manager(tournament_id)
    OR EXISTS (
      SELECT 1 FROM public.tournament_operators o
       WHERE o.tournament_id = tournament_stream_featured.tournament_id
         AND o.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_tournament_manager(tournament_id)
    OR EXISTS (
      SELECT 1 FROM public.tournament_operators o
       WHERE o.tournament_id = tournament_stream_featured.tournament_id
         AND o.user_id = auth.uid()
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_stream_featured;

-- 3. Public RPCs
CREATE OR REPLACE FUNCTION public.get_public_stream_tournament(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t record;
  v_cb record;
  v_current_round int;
  v_total_rounds int;
BEGIN
  SELECT id, name, status, slug
    INTO v_t
    FROM public.tournaments
   WHERE slug = _slug AND is_public_stream_enabled = true;

  IF v_t.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_cb FROM public.tournament_cobrand WHERE tournament_id = v_t.id;

  SELECT max(round_number), max(round_number)
    INTO v_current_round, v_total_rounds
    FROM public.americano_rounds ar
    JOIN public.tournament_categories tc ON tc.id = ar.tournament_category_id
   WHERE tc.tournament_id = v_t.id;

  RETURN jsonb_build_object(
    'id', v_t.id,
    'name', v_t.name,
    'slug', v_t.slug,
    'status', v_t.status,
    'current_round', v_current_round,
    'total_rounds', v_total_rounds,
    'cobrand', CASE WHEN v_cb.tournament_id IS NULL THEN NULL ELSE jsonb_build_object(
      'display_name', v_cb.display_name,
      'logo_url', v_cb.logo_url,
      'primary_hex', v_cb.primary_hex,
      'accent_hex', v_cb.accent_hex,
      'gradient_css', v_cb.gradient_css,
      'lockup_text', v_cb.lockup_text
    ) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_stream_standings(_slug text, _limit int DEFAULT 12)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament_id uuid;
  v_rows jsonb;
BEGIN
  SELECT id INTO v_tournament_id
    FROM public.tournaments
   WHERE slug = _slug AND is_public_stream_enabled = true;
  IF v_tournament_id IS NULL THEN RETURN NULL; END IF;

  WITH latest AS (
    SELECT DISTINCT ON (tournament_category_id) tournament_category_id, snapshot
      FROM public.standings_snapshots
     WHERE tournament_id = v_tournament_id
     ORDER BY tournament_category_id, created_at DESC
  ),
  flat AS (
    SELECT
      jsonb_array_elements(snapshot->'rows') AS row
      FROM latest
  ),
  ranked AS (
    SELECT
      coalesce(row->>'display_name', row->>'name', 'Jugador') AS display_name,
      coalesce(row->>'initials', upper(left(coalesce(row->>'display_name', row->>'name', 'JU'), 2))) AS initials,
      coalesce((row->>'points')::int, (row->>'total_points')::int, 0) AS points
      FROM flat
  )
  SELECT jsonb_agg(jsonb_build_object(
    'rank', rn,
    'display_name', display_name,
    'initials', initials,
    'points', points
  ) ORDER BY rn)
    INTO v_rows
    FROM (
      SELECT display_name, initials, points,
             row_number() OVER (ORDER BY points DESC) AS rn
        FROM ranked
       ORDER BY points DESC
       LIMIT _limit
    ) t;

  RETURN jsonb_build_object('rows', coalesce(v_rows, '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_stream_now_playing(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament_id uuid;
  v_match record;
  v_court_name text;
  v_side_a_names text;
  v_side_b_names text;
BEGIN
  SELECT id INTO v_tournament_id
    FROM public.tournaments
   WHERE slug = _slug AND is_public_stream_enabled = true;
  IF v_tournament_id IS NULL THEN RETURN NULL; END IF;

  -- Try featured first
  SELECT m.*
    INTO v_match
    FROM public.tournament_stream_featured f
    JOIN public.tournament_matches m ON m.id = f.match_id
   WHERE f.tournament_id = v_tournament_id;

  -- Fallback to latest en_curso
  IF v_match.id IS NULL THEN
    SELECT m.*
      INTO v_match
      FROM public.tournament_matches m
     WHERE m.tournament_id = v_tournament_id
       AND m.status = 'en_curso'
     ORDER BY m.updated_at DESC
     LIMIT 1;
  END IF;

  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('match', NULL);
  END IF;

  SELECT c.name INTO v_court_name
    FROM public.courts c
   WHERE c.id = v_match.court_id;

  SELECT string_agg(coalesce(p.first_name || ' ' || left(p.last_name, 1) || '.', 'Jugador'), ' · ')
    INTO v_side_a_names
    FROM unnest(v_match.side_a_user_ids) AS uid
    LEFT JOIN public.profiles p ON p.user_id = uid;

  SELECT string_agg(coalesce(p.first_name || ' ' || left(p.last_name, 1) || '.', 'Jugador'), ' · ')
    INTO v_side_b_names
    FROM unnest(v_match.side_b_user_ids) AS uid
    LEFT JOIN public.profiles p ON p.user_id = uid;

  RETURN jsonb_build_object(
    'match', jsonb_build_object(
      'id', v_match.id,
      'court', coalesce(v_court_name, 'Cancha'),
      'round', v_match.round,
      'status', v_match.status,
      'side_a_names', coalesce(v_side_a_names, 'Jugador A'),
      'side_b_names', coalesce(v_side_b_names, 'Jugador B'),
      'score', v_match.score,
      'partial_score', v_match.partial_score
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stream_tournament(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_stream_standings(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_stream_now_playing(text) TO anon, authenticated;