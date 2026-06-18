
-- =====================================================================
-- generate_groups: distribuye inscripciones en N grupos (snake seeding)
-- y crea los round robins internos. NO genera el bracket del playoff.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.generate_groups(
  _category_id uuid,
  _groups_count int,
  _seed_order uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cat        public.tournament_categories%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_regs       uuid[];
  v_n          integer;
  v_g          integer := _groups_count;
  v_i          integer;
  v_group_idx  integer;
  v_pass       integer;
  v_group_ids  uuid[] := ARRAY[]::uuid[];
  v_group_id   uuid;
  v_group_regs uuid[];
  v_a          integer;
  v_b          integer;
  v_pos        integer := 0;
  v_matches    integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF v_g IS NULL OR v_g < 2 THEN RAISE EXCEPTION 'Se requieren al menos 2 grupos'; END IF;

  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = _category_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;
  IF v_cat.motor <> 'grupos_playoff' THEN
    RAISE EXCEPTION 'La categoría no es grupos_playoff';
  END IF;
  IF v_cat.bracket_generated_at IS NOT NULL OR v_cat.roster_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Los grupos ya fueron generados';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_cat.tournament_id;
  IF NOT public.is_tournament_manager(v_tournament.id) THEN
    RAISE EXCEPTION 'Sin permisos para gestionar este torneo';
  END IF;

  IF _seed_order IS NOT NULL AND array_length(_seed_order, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(_seed_order) s(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.tournament_registrations r
        WHERE r.id = s.id AND r.tournament_category_id = _category_id AND r.status = 'confirmada'
      )
    ) THEN
      RAISE EXCEPTION 'El orden de siembra contiene inscripciones inválidas';
    END IF;
    v_regs := _seed_order;
  ELSE
    SELECT array_agg(id ORDER BY (seed IS NULL), seed NULLS LAST, registered_at)
      INTO v_regs
    FROM public.tournament_registrations
    WHERE tournament_category_id = _category_id AND status = 'confirmada';
  END IF;

  v_n := COALESCE(array_length(v_regs, 1), 0);
  IF v_n < v_g * 2 THEN
    RAISE EXCEPTION 'Se requieren al menos % inscritos confirmados (hay %)', v_g * 2, v_n;
  END IF;

  -- Crear los grupos A..N
  FOR v_i IN 1..v_g LOOP
    INSERT INTO public.tournament_groups (tenant_id, tournament_category_id, name, sort_order)
    VALUES (v_tournament.tenant_id, _category_id, chr(64 + v_i), v_i)
    RETURNING id INTO v_group_id;
    v_group_ids := array_append(v_group_ids, v_group_id);
  END LOOP;

  -- Distribuir inscripciones en serpiente:
  -- pasada k (0-index): si k par → izquierda a derecha; si impar → derecha a izquierda.
  FOR v_i IN 1..v_n LOOP
    v_pass := (v_i - 1) / v_g;          -- nº de pasada (0-index)
    IF v_pass % 2 = 0 THEN
      v_group_idx := ((v_i - 1) % v_g) + 1;
    ELSE
      v_group_idx := v_g - ((v_i - 1) % v_g);
    END IF;
    -- registramos vía tabla temporal en memoria usando array dinámico
    -- (no podemos modificar arrays nested en plpgsql cómodamente; preferimos query)
    PERFORM 1;
  END LOOP;

  -- Generar matches de cada grupo
  FOR v_i IN 1..v_g LOOP
    v_group_id := v_group_ids[v_i];
    -- Recolectar inscripciones de este grupo en el orden de siembra
    SELECT array_agg(reg ORDER BY ord)
      INTO v_group_regs
    FROM (
      SELECT
        v_regs[ord_in.ord] AS reg,
        ord_in.ord
      FROM generate_series(1, v_n) AS ord_in(ord)
      WHERE (
        CASE
          WHEN ((ord_in.ord - 1) / v_g) % 2 = 0
            THEN ((ord_in.ord - 1) % v_g) + 1
          ELSE v_g - ((ord_in.ord - 1) % v_g)
        END
      ) = v_i
    ) sub;

    IF v_group_regs IS NULL OR array_length(v_group_regs, 1) < 2 THEN
      CONTINUE;
    END IF;

    FOR v_a IN 1..(array_length(v_group_regs, 1) - 1) LOOP
      FOR v_b IN (v_a + 1)..array_length(v_group_regs, 1) LOOP
        v_pos := v_pos + 1;
        INSERT INTO public.tournament_matches (
          tournament_id, tenant_id, tournament_category_id,
          tournament_group_id, phase,
          round, bracket_position,
          registration_a_id, registration_b_id,
          status
        ) VALUES (
          v_tournament.id, v_tournament.tenant_id, _category_id,
          v_group_id, 'grupos',
          v_i, v_pos,
          v_group_regs[v_a], v_group_regs[v_b],
          'pendiente'::public.match_status
        );
        v_matches := v_matches + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  UPDATE public.tournament_categories
     SET groups_count = v_g,
         roster_locked_at = now(),
         bracket_generated_at = now(),
         status = 'en_curso'
   WHERE id = _category_id;

  RETURN jsonb_build_object(
    'groups_count', v_g,
    'matches_created', v_matches
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_groups(uuid, int, uuid[]) TO authenticated;

-- =====================================================================
-- Vista round_robin_group_standings: posiciones POR GRUPO
-- =====================================================================
DROP VIEW IF EXISTS public.round_robin_group_standings;
CREATE VIEW public.round_robin_group_standings
WITH (security_invoker = on)
AS
WITH m AS (
  SELECT
    tm.tournament_category_id,
    tm.tournament_group_id,
    tm.id AS match_id,
    tm.status,
    tm.winner_registration_id,
    tm.registration_a_id,
    tm.registration_b_id,
    tm.score
  FROM public.tournament_matches tm
  WHERE tm.phase = 'grupos'
    AND tm.tournament_group_id IS NOT NULL
    AND tm.status = 'jugado'
), per_side AS (
  SELECT
    m.tournament_category_id AS category_id,
    m.tournament_group_id    AS group_id,
    side.reg_id AS registration_id,
    (m.winner_registration_id = side.reg_id)::int AS won,
    1 AS played,
    COALESCE(side.sets_won, 0) AS sets_won,
    COALESCE(side.games_won, 0) AS games_won,
    COALESCE(side.stb_won, 0)   AS stb_won
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
    category_id, group_id, registration_id,
    sum(played)::int   AS matches_played,
    sum(won)::int      AS matches_won,
    sum(sets_won)::int AS sets_won,
    sum(games_won)::int AS games_won,
    sum(stb_won)::int  AS stb_games_won
  FROM per_side
  GROUP BY category_id, group_id, registration_id
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
  w.group_id,
  w.registration_id,
  w.matches_played,
  w.matches_won,
  w.sets_won,
  w.games_won,
  w.stb_games_won,
  w.total_points,
  ROW_NUMBER() OVER (
    PARTITION BY w.group_id
    ORDER BY w.total_points DESC, w.matches_won DESC, w.registration_id
  )::int AS position
FROM with_pts w;

GRANT SELECT ON public.round_robin_group_standings TO authenticated;

-- =====================================================================
-- advance_groups_to_playoff: clasifica top N por grupo y arma el bracket
-- =====================================================================
CREATE OR REPLACE FUNCTION public.advance_groups_to_playoff(_category_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cat            public.tournament_categories%ROWTYPE;
  v_tournament     public.tournaments%ROWTYPE;
  v_pending        integer;
  v_g              integer;
  v_q              integer;
  v_total          integer;
  v_bracket_size   integer := 2;
  v_total_rounds   integer;
  v_seed_order     uuid[] := ARRAY[]::uuid[];
  v_groups         uuid[];
  v_group_id       uuid;
  v_classified     record;
  v_pos            integer;
  v_round          integer;
  v_m              integer;
  v_p              integer;
  v_a              uuid;
  v_b              uuid;
  v_match_id       uuid;
  v_next_id        uuid;
  v_next_slot      char(1);
  v_pair_idx       integer;
  v_count          integer;
  v_seed_pairs     uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = _category_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;
  IF v_cat.motor <> 'grupos_playoff' THEN
    RAISE EXCEPTION 'La categoría no es grupos_playoff';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_cat.tournament_id;
  IF NOT public.is_tournament_manager(v_tournament.id) THEN
    RAISE EXCEPTION 'Sin permisos para gestionar este torneo';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tournament_matches
    WHERE tournament_category_id = _category_id AND phase = 'playoff'
  ) THEN
    RAISE EXCEPTION 'El playoff ya fue generado';
  END IF;

  SELECT count(*) INTO v_pending
  FROM public.tournament_matches
  WHERE tournament_category_id = _category_id
    AND phase = 'grupos'
    AND status NOT IN ('jugado','walkover');
  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Hay % partido(s) de grupos pendientes', v_pending;
  END IF;

  v_g := COALESCE(v_cat.groups_count, 0);
  v_q := COALESCE(v_cat.qualifiers_per_group, 2);
  IF v_g < 2 THEN RAISE EXCEPTION 'No hay grupos configurados'; END IF;

  -- Orden de grupos por sort_order
  SELECT array_agg(id ORDER BY sort_order) INTO v_groups
  FROM public.tournament_groups
  WHERE tournament_category_id = _category_id;

  -- Construir pares de clasificación: para cada grupo, top v_q por position
  -- Lo guardamos como array indexable: v_seed_pairs[(group_idx-1)*v_q + position]
  v_seed_pairs := ARRAY[]::uuid[];
  FOR v_pair_idx IN 1..(v_g * v_q) LOOP
    v_seed_pairs := array_append(v_seed_pairs, NULL::uuid);
  END LOOP;

  FOR v_classified IN
    SELECT group_id, position, registration_id
    FROM public.round_robin_group_standings
    WHERE category_id = _category_id AND position <= v_q
  LOOP
    -- índice del grupo
    FOR v_pos IN 1..v_g LOOP
      IF v_groups[v_pos] = v_classified.group_id THEN
        v_seed_pairs[(v_pos - 1) * v_q + v_classified.position] := v_classified.registration_id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  -- Armar el seed_order del bracket con cruces estándar:
  -- Para v_q = 2: para cada par de grupos consecutivos (A,B), (C,D):
  --   1A-2B, 1B-2A, 1C-2D, 1D-2C
  -- Para v_q distinto, intercalar 1° de grupo_i con último de grupo_{i+1}.
  IF v_q = 2 AND v_g % 2 = 0 THEN
    FOR v_pos IN 1..(v_g / 2) LOOP
      -- pareja (Gi, Gi+1) donde i = 2*v_pos - 1
      DECLARE
        g1 integer := 2 * v_pos - 1;
        g2 integer := 2 * v_pos;
      BEGIN
        v_seed_order := array_append(v_seed_order, v_seed_pairs[(g1 - 1) * v_q + 1]); -- 1°g1
        v_seed_order := array_append(v_seed_order, v_seed_pairs[(g2 - 1) * v_q + 2]); -- 2°g2
        v_seed_order := array_append(v_seed_order, v_seed_pairs[(g2 - 1) * v_q + 1]); -- 1°g2
        v_seed_order := array_append(v_seed_order, v_seed_pairs[(g1 - 1) * v_q + 2]); -- 2°g1
      END;
    END LOOP;
  ELSE
    -- Fallback: orden serpiente por posición y grupo
    FOR v_pos IN 1..v_q LOOP
      IF v_pos % 2 = 1 THEN
        FOR v_pair_idx IN 1..v_g LOOP
          v_seed_order := array_append(v_seed_order, v_seed_pairs[(v_pair_idx - 1) * v_q + v_pos]);
        END LOOP;
      ELSE
        FOR v_pair_idx IN REVERSE v_g..1 LOOP
          v_seed_order := array_append(v_seed_order, v_seed_pairs[(v_pair_idx - 1) * v_q + v_pos]);
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  v_total := array_length(v_seed_order, 1);
  IF v_total IS NULL OR v_total < 2 THEN
    RAISE EXCEPTION 'No hay suficientes clasificados para armar un bracket';
  END IF;

  v_bracket_size := 2;
  WHILE v_bracket_size < v_total LOOP v_bracket_size := v_bracket_size * 2; END LOOP;
  v_total_rounds := CEIL(LOG(2, v_bracket_size))::INTEGER;

  WHILE COALESCE(array_length(v_seed_order, 1), 0) < v_bracket_size LOOP
    v_seed_order := array_append(v_seed_order, NULL::uuid);
  END LOOP;

  -- Crear partidos del bracket de playoff, marcados con phase='playoff'
  FOR v_round IN REVERSE 1..v_total_rounds LOOP
    v_m := v_bracket_size / (2 ^ (v_total_rounds - v_round + 1))::INTEGER;
    FOR v_p IN 1..v_m LOOP
      INSERT INTO public.tournament_matches (
        tournament_id, tournament_category_id, tenant_id,
        round, bracket_position, phase
      ) VALUES (
        v_tournament.id, _category_id, v_tournament.tenant_id,
        v_round, v_p, 'playoff'
      );
    END LOOP;
  END LOOP;

  -- Linkar next_match_id (acotado a phase='playoff')
  UPDATE public.tournament_matches m
  SET next_match_id = nm.id,
      next_match_slot = CASE WHEN (m.bracket_position % 2) = 1 THEN 'a' ELSE 'b' END
  FROM public.tournament_matches nm
  WHERE m.tournament_category_id = _category_id
    AND nm.tournament_category_id = _category_id
    AND m.phase = 'playoff' AND nm.phase = 'playoff'
    AND m.round > 1
    AND nm.round = m.round - 1
    AND nm.bracket_position = CEIL(m.bracket_position::NUMERIC / 2);

  -- Asignar inscripciones a la primera ronda del playoff
  FOR v_p IN 1..(v_bracket_size / 2) LOOP
    v_a := v_seed_order[(v_p - 1) * 2 + 1];
    v_b := v_seed_order[(v_p - 1) * 2 + 2];

    UPDATE public.tournament_matches
    SET registration_a_id = v_a,
        registration_b_id = v_b,
        status = (CASE
          WHEN v_a IS NULL OR v_b IS NULL THEN 'walkover'
          ELSE 'pendiente'
        END)::public.match_status,
        winner_registration_id = CASE
          WHEN v_a IS NOT NULL AND v_b IS NULL THEN v_a
          WHEN v_b IS NOT NULL AND v_a IS NULL THEN v_b
          ELSE NULL
        END,
        walkover = (v_a IS NULL OR v_b IS NULL)
    WHERE tournament_category_id = _category_id
      AND phase = 'playoff'
      AND round = v_total_rounds
      AND bracket_position = v_p;
  END LOOP;

  -- Propagar walkovers a la siguiente ronda
  FOR v_match_id, v_a, v_next_id, v_next_slot IN
    SELECT id, winner_registration_id, next_match_id, next_match_slot
    FROM public.tournament_matches
    WHERE tournament_category_id = _category_id
      AND phase = 'playoff'
      AND round = v_total_rounds
      AND walkover = true
      AND winner_registration_id IS NOT NULL
      AND next_match_id IS NOT NULL
  LOOP
    UPDATE public.tournament_matches
    SET registration_a_id = CASE WHEN v_next_slot = 'a' THEN v_a ELSE registration_a_id END,
        registration_b_id = CASE WHEN v_next_slot = 'b' THEN v_a ELSE registration_b_id END
    WHERE id = v_next_id;
  END LOOP;

  RETURN jsonb_build_object(
    'bracket_size', v_bracket_size,
    'rounds', v_total_rounds,
    'classified', v_total
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.advance_groups_to_playoff(uuid) TO authenticated;
