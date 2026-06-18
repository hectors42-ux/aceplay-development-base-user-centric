
-- ============================================================
-- generate_round_robin: congela el roster y genera N*(N-1)/2 partidos
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_round_robin(_category_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cat        public.tournament_categories%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_regs       uuid[];
  v_n          integer;
  v_i          integer;
  v_j          integer;
  v_pos        integer := 0;
  v_count      integer := 0;
  v_phase_idx  integer;
  v_round_dt   timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = _category_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;
  IF v_cat.motor <> 'round_robin' THEN
    RAISE EXCEPTION 'La categoría no es round_robin';
  END IF;
  IF v_cat.bracket_generated_at IS NOT NULL OR v_cat.roster_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'El fixture ya fue generado';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_cat.tournament_id;
  IF NOT public.is_tournament_manager(v_tournament.id) THEN
    RAISE EXCEPTION 'Sin permisos para gestionar este torneo';
  END IF;

  SELECT array_agg(id ORDER BY COALESCE(seed, 999999), registered_at)
    INTO v_regs
  FROM public.tournament_registrations
  WHERE tournament_category_id = _category_id AND status = 'confirmada';

  v_n := COALESCE(array_length(v_regs, 1), 0);
  IF v_n < 3 THEN
    RAISE EXCEPTION 'Se requieren al menos 3 inscritos confirmados (hay %)', v_n;
  END IF;

  FOR v_i IN 1..(v_n - 1) LOOP
    FOR v_j IN (v_i + 1)..v_n LOOP
      v_pos := v_pos + 1;
      v_phase_idx := CASE
        WHEN v_cat.scheduling = 'fixture_auto'
          THEN ((v_pos - 1) / GREATEST(1, v_n / 2)) + 1
        ELSE NULL
      END;
      v_round_dt := CASE
        WHEN v_cat.scheduling = 'fixture_auto' AND v_tournament.starts_at IS NOT NULL
          THEN v_tournament.starts_at + ((v_phase_idx - 1) || ' days')::interval
        ELSE NULL
      END;

      INSERT INTO public.tournament_matches (
        tournament_id, tenant_id, tournament_category_id,
        round, bracket_position,
        registration_a_id, registration_b_id,
        status, scheduled_at
      ) VALUES (
        v_tournament.id, v_tournament.tenant_id, _category_id,
        COALESCE(v_phase_idx, 1), v_pos,
        v_regs[v_i], v_regs[v_j],
        'pendiente'::match_status, v_round_dt
      );
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  UPDATE public.tournament_categories
     SET roster_locked_at = now(),
         bracket_generated_at = now()
   WHERE id = _category_id;

  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_round_robin(uuid) TO authenticated;

-- ============================================================
-- create_tournament_challenge: reusa ladder_challenges + slots
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_tournament_challenge(
  _category_id uuid,
  _challenged_user_id uuid,
  _slots jsonb,
  _challenger_partner_user_id uuid DEFAULT NULL
)
RETURNS public.ladder_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id     uuid := auth.uid();
  v_cat         public.tournament_categories%ROWTYPE;
  v_tournament  public.tournaments%ROWTYPE;
  v_reg_a       uuid;
  v_reg_b       uuid;
  v_match       public.tournament_matches%ROWTYPE;
  v_challenge   public.ladder_challenges;
  v_starts1 timestamptz; v_court1 uuid;
  v_starts2 timestamptz; v_court2 uuid;
  v_starts3 timestamptz; v_court3 uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF v_user_id = _challenged_user_id THEN RAISE EXCEPTION 'No puedes desafiarte a ti mismo'; END IF;

  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;
  IF v_cat.motor <> 'round_robin' OR v_cat.scheduling <> 'desafio_libre' THEN
    RAISE EXCEPTION 'Los desafíos libres no están habilitados en esta categoría';
  END IF;
  IF v_cat.roster_locked_at IS NULL THEN
    RAISE EXCEPTION 'El fixture todavía no se ha generado';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_cat.tournament_id;

  SELECT id INTO v_reg_a
  FROM public.tournament_registrations
  WHERE tournament_category_id = _category_id
    AND status = 'confirmada'
    AND (player1_user_id = v_user_id OR player2_user_id = v_user_id)
  LIMIT 1;
  IF v_reg_a IS NULL THEN RAISE EXCEPTION 'No estás inscrito en la categoría'; END IF;

  SELECT id INTO v_reg_b
  FROM public.tournament_registrations
  WHERE tournament_category_id = _category_id
    AND status = 'confirmada'
    AND (player1_user_id = _challenged_user_id OR player2_user_id = _challenged_user_id)
  LIMIT 1;
  IF v_reg_b IS NULL THEN RAISE EXCEPTION 'El rival no está inscrito en la categoría'; END IF;

  SELECT * INTO v_match
  FROM public.tournament_matches
  WHERE tournament_category_id = _category_id
    AND status = 'pendiente'
    AND (
      (registration_a_id = v_reg_a AND registration_b_id = v_reg_b)
      OR (registration_a_id = v_reg_b AND registration_b_id = v_reg_a)
    )
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ya no hay un partido pendiente entre ustedes';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ladder_challenges
    WHERE tournament_match_id = v_match.id
      AND status IN ('propuesto','aceptado','programado')
  ) THEN
    RAISE EXCEPTION 'Ya hay un desafío activo para este partido';
  END IF;

  v_starts1 := (_slots->0->>'starts_at')::timestamptz;
  v_court1  := NULLIF(_slots->0->>'court_id','')::uuid;
  v_starts2 := (_slots->1->>'starts_at')::timestamptz;
  v_court2  := NULLIF(_slots->1->>'court_id','')::uuid;
  v_starts3 := (_slots->2->>'starts_at')::timestamptz;
  v_court3  := NULLIF(_slots->2->>'court_id','')::uuid;

  IF v_starts1 IS NULL OR v_starts2 IS NULL OR v_starts3 IS NULL THEN
    RAISE EXCEPTION 'Debes proponer 3 horarios';
  END IF;
  IF v_starts1 = v_starts2 OR v_starts1 = v_starts3 OR v_starts2 = v_starts3 THEN
    RAISE EXCEPTION 'Los 3 horarios deben ser distintos';
  END IF;

  INSERT INTO public.ladder_challenges (
    tenant_id, ladder_id, tournament_category_id, tournament_match_id,
    challenger_user_id, challenged_user_id,
    challenger_partner_user_id,
    status, expires_at
  ) VALUES (
    v_tournament.tenant_id, NULL, _category_id, v_match.id,
    v_user_id, _challenged_user_id,
    _challenger_partner_user_id,
    'propuesto'::ladder_challenge_status,
    now() + interval '72 hours'
  )
  RETURNING * INTO v_challenge;

  INSERT INTO public.ladder_challenge_schedule_proposals (
    tenant_id, challenge_id, proposed_by,
    slot1_starts_at, slot1_court_id,
    slot2_starts_at, slot2_court_id,
    slot3_starts_at, slot3_court_id,
    status
  ) VALUES (
    v_tournament.tenant_id, v_challenge.id, v_user_id,
    v_starts1, v_court1,
    v_starts2, v_court2,
    v_starts3, v_court3,
    'pendiente'
  );

  RETURN v_challenge;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_tournament_challenge(uuid, uuid, jsonb, uuid) TO authenticated;

-- ============================================================
-- get_round_robin_opponents: roster confirmado sin enfrentar
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_round_robin_opponents(_category_id uuid)
RETURNS TABLE (
  user_id uuid,
  registration_id uuid,
  full_name text,
  avatar_url text,
  tournament_match_id uuid,
  has_open_challenge boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_my_reg  uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT id INTO v_my_reg
  FROM public.tournament_registrations
  WHERE tournament_category_id = _category_id
    AND status = 'confirmada'
    AND (player1_user_id = v_user_id OR player2_user_id = v_user_id)
  LIMIT 1;
  IF v_my_reg IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    COALESCE(r.player1_user_id, r.player2_user_id) AS user_id,
    r.id AS registration_id,
    p.full_name,
    p.avatar_url,
    m.id AS tournament_match_id,
    EXISTS (
      SELECT 1 FROM public.ladder_challenges lc
      WHERE lc.tournament_match_id = m.id
        AND lc.status IN ('propuesto','aceptado','programado')
    ) AS has_open_challenge
  FROM public.tournament_matches m
  JOIN public.tournament_registrations r
    ON r.id = CASE WHEN m.registration_a_id = v_my_reg THEN m.registration_b_id ELSE m.registration_a_id END
  LEFT JOIN public.profiles p
    ON p.id = COALESCE(r.player1_user_id, r.player2_user_id)
  WHERE m.tournament_category_id = _category_id
    AND m.status = 'pendiente'
    AND (m.registration_a_id = v_my_reg OR m.registration_b_id = v_my_reg);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_round_robin_opponents(uuid) TO authenticated;

-- ============================================================
-- Trigger puente: ladder_challenges (status='jugado') → tournament_matches
-- ============================================================
CREATE OR REPLACE FUNCTION public._tg_bridge_challenge_to_tournament_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_winner_reg uuid;
  v_match public.tournament_matches%ROWTYPE;
BEGIN
  IF NEW.tournament_match_id IS NULL THEN RETURN NEW; END IF;

  -- Caso terminal "jugado": empujar al tournament_match
  IF NEW.status = 'jugado'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'jugado') THEN

    SELECT * INTO v_match FROM public.tournament_matches WHERE id = NEW.tournament_match_id;
    IF NOT FOUND THEN RETURN NEW; END IF;

    SELECT id INTO v_winner_reg
    FROM public.tournament_registrations
    WHERE id IN (v_match.registration_a_id, v_match.registration_b_id)
      AND (player1_user_id = NEW.winner_user_id OR player2_user_id = NEW.winner_user_id)
    LIMIT 1;

    UPDATE public.tournament_matches
       SET status = 'jugado'::match_status,
           score = NEW.score,
           winner_registration_id = v_winner_reg,
           walkover = COALESCE(NEW.walkover, false),
           retired  = COALESCE(NEW.retired,  false),
           played_at = COALESCE(NEW.played_at, now())
     WHERE id = NEW.tournament_match_id;

  -- Cancelado/expirado: liberar el match para volver a desafiar
  ELSIF NEW.status IN ('rechazado','expirado','cancelado')
        AND (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.tournament_match_id := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tg_bridge_challenge_to_tournament_match ON public.ladder_challenges;
CREATE TRIGGER tg_bridge_challenge_to_tournament_match
  BEFORE INSERT OR UPDATE ON public.ladder_challenges
  FOR EACH ROW EXECUTE FUNCTION public._tg_bridge_challenge_to_tournament_match();

-- ============================================================
-- Vista round_robin_standings
-- ============================================================
DROP VIEW IF EXISTS public.round_robin_standings;
CREATE VIEW public.round_robin_standings
WITH (security_invoker = on)
AS
WITH m AS (
  SELECT
    tm.tournament_category_id,
    tm.id AS match_id,
    tm.status,
    tm.winner_registration_id,
    tm.registration_a_id,
    tm.registration_b_id,
    tm.score
  FROM public.tournament_matches tm
  WHERE tm.tournament_category_id IS NOT NULL
    AND tm.status = 'jugado'
), per_side AS (
  -- Una fila por jugador del partido con sus métricas calculadas desde score jsonb
  SELECT
    m.tournament_category_id AS category_id,
    side.reg_id AS registration_id,
    (m.winner_registration_id = side.reg_id)::int AS won,
    1 AS played,
    COALESCE(side.sets_won, 0) AS sets_won,
    COALESCE(side.games_won, 0) AS games_won,
    COALESCE(side.stb_won, 0) AS stb_won
  FROM m
  CROSS JOIN LATERAL (
    VALUES
      (
        m.registration_a_id,
        (SELECT count(*)::int FROM jsonb_array_elements(COALESCE(m.score->'sets','[]'::jsonb)) s
          WHERE (s->>'a')::int > (s->>'b')::int AND (s->>'a')::int < 7),
        COALESCE((SELECT sum((s->>'a')::int)::int FROM jsonb_array_elements(COALESCE(m.score->'sets','[]'::jsonb)) s), 0),
        COALESCE(NULLIF(m.score->>'stb_a','')::int, 0)
      ),
      (
        m.registration_b_id,
        (SELECT count(*)::int FROM jsonb_array_elements(COALESCE(m.score->'sets','[]'::jsonb)) s
          WHERE (s->>'b')::int > (s->>'a')::int AND (s->>'b')::int < 7),
        COALESCE((SELECT sum((s->>'b')::int)::int FROM jsonb_array_elements(COALESCE(m.score->'sets','[]'::jsonb)) s), 0),
        COALESCE(NULLIF(m.score->>'stb_b','')::int, 0)
      )
  ) AS side(reg_id, sets_won, games_won, stb_won)
), agg AS (
  SELECT
    category_id,
    registration_id,
    sum(played)::int AS matches_played,
    sum(won)::int    AS matches_won,
    sum(sets_won)::int AS sets_won,
    sum(games_won)::int AS games_won,
    sum(stb_won)::int AS stb_games_won
  FROM per_side
  GROUP BY category_id, registration_id
), with_pts AS (
  SELECT
    a.*,
    (
      COALESCE((tc.tiebreaker_weights->>'matches')::numeric, 1)    * a.matches_won
    + COALESCE((tc.tiebreaker_weights->>'sets')::numeric,    0.1)  * a.sets_won
    + COALESCE((tc.tiebreaker_weights->>'games')::numeric,   0.01) * a.games_won
    + COALESCE((tc.tiebreaker_weights->>'stb')::numeric,     0.001)* a.stb_games_won
    )::numeric AS total_points
  FROM agg a
  JOIN public.tournament_categories tc ON tc.id = a.category_id
)
SELECT
  w.category_id,
  w.registration_id,
  w.matches_played,
  w.matches_won,
  w.sets_won,
  w.games_won,
  w.stb_games_won,
  w.total_points,
  ROW_NUMBER() OVER (
    PARTITION BY w.category_id
    ORDER BY w.total_points DESC, w.matches_won DESC, w.registration_id
  )::int AS position
FROM with_pts w;

GRANT SELECT ON public.round_robin_standings TO authenticated;

-- ============================================================
-- Realtime
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tournament_matches'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches';
  END IF;
END $$;
