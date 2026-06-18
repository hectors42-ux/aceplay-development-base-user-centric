
-- 1) Tenants: flag de fuente verificada
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_institutional boolean NOT NULL DEFAULT false;

-- 2) Tabla outbox del contrato match_observation
CREATE TABLE IF NOT EXISTS public.match_observation_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tournament_match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  sport text NOT NULL,
  format text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('tournament','escalerilla')),
  verified_source boolean NOT NULL DEFAULT false,
  side_a_players uuid[] NOT NULL,
  side_b_players uuid[] NOT NULL,
  match_winner char(1) NOT NULL CHECK (match_winner IN ('a','b')),
  sets jsonb NOT NULL,
  played_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'emitted' CHECK (status IN ('emitted','reverted')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.match_observation_outbox TO authenticated;
GRANT ALL ON public.match_observation_outbox TO service_role;

ALTER TABLE public.match_observation_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Socios leen outbox de su club" ON public.match_observation_outbox;
CREATE POLICY "Socios leen outbox de su club"
ON public.match_observation_outbox
FOR SELECT
TO authenticated
USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
-- No INSERT/UPDATE/DELETE policies: escritura solo vía funciones SECURITY DEFINER.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_outbox_emitted_per_match
  ON public.match_observation_outbox (tournament_match_id)
  WHERE status = 'emitted';

CREATE INDEX IF NOT EXISTS idx_outbox_tenant_played_at
  ON public.match_observation_outbox (tenant_id, played_at DESC);

-- 3) Función: emitir observación (productor del contrato)
CREATE OR REPLACE FUNCTION public.emit_match_observation(_tournament_match_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_cat   public.tournament_categories%ROWTYPE;
  v_reg_a public.tournament_registrations%ROWTYPE;
  v_reg_b public.tournament_registrations%ROWTYPE;
  v_tenant_inst boolean;
  v_existing_id uuid;
  v_new_id uuid;
  v_winner char(1);
  v_source_type text;
  v_side_a uuid[];
  v_side_b uuid[];
  v_winners uuid[];
  v_losers uuid[];
  v_sport_enum public.rating_sport;
BEGIN
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _tournament_match_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_match.status::text <> 'jugado' THEN RETURN NULL; END IF;
  IF v_match.walkover THEN RETURN NULL; END IF;
  IF v_match.winner_registration_id IS NULL THEN RETURN NULL; END IF;
  IF v_match.score IS NULL THEN RETURN NULL; END IF;
  IF v_match.registration_a_id IS NULL OR v_match.registration_b_id IS NULL THEN RETURN NULL; END IF;

  -- Idempotencia: si ya hay una observación emitida, salir sin re-emitir ni re-aplicar rating
  SELECT id INTO v_existing_id
    FROM public.match_observation_outbox
   WHERE tournament_match_id = _tournament_match_id AND status = 'emitted'
   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = v_match.tournament_category_id;
  SELECT * INTO v_reg_a FROM public.tournament_registrations WHERE id = v_match.registration_a_id;
  SELECT * INTO v_reg_b FROM public.tournament_registrations WHERE id = v_match.registration_b_id;

  v_side_a := ARRAY_REMOVE(ARRAY[v_reg_a.player1_user_id, v_reg_a.player2_user_id], NULL);
  v_side_b := ARRAY_REMOVE(ARRAY[v_reg_b.player1_user_id, v_reg_b.player2_user_id], NULL);

  IF v_match.winner_registration_id = v_reg_a.id THEN
    v_winner := 'a'; v_winners := v_side_a; v_losers := v_side_b;
  ELSE
    v_winner := 'b'; v_winners := v_side_b; v_losers := v_side_a;
  END IF;

  v_source_type := CASE WHEN v_cat.preset_key = 'escalerilla' THEN 'escalerilla' ELSE 'tournament' END;

  SELECT is_institutional INTO v_tenant_inst FROM public.tenants WHERE id = v_match.tenant_id;

  INSERT INTO public.match_observation_outbox (
    tenant_id, tournament_match_id, sport, format, source_type, verified_source,
    side_a_players, side_b_players, match_winner, sets, played_at, status
  ) VALUES (
    v_match.tenant_id,
    _tournament_match_id,
    v_cat.sport::text,
    v_cat.modality::text,
    v_source_type,
    COALESCE(v_tenant_inst, false),
    v_side_a,
    v_side_b,
    v_winner,
    v_match.score,
    COALESCE(v_match.played_at, v_match.updated_at, now()),
    'emitted'
  ) RETURNING id INTO v_new_id;

  -- Alimentar el rating ad-hoc actual (mismo comportamiento de antes)
  v_sport_enum := CASE v_cat.discipline::text
    WHEN 'tenis_singles' THEN 'tenis_singles'::public.rating_sport
    WHEN 'tenis_dobles'  THEN 'tenis_dobles'::public.rating_sport
    WHEN 'padel'         THEN 'padel'::public.rating_sport
    ELSE 'tenis_singles'::public.rating_sport
  END;

  IF array_length(v_winners,1) > 0 AND array_length(v_losers,1) > 0 THEN
    PERFORM public._apply_rating_for_match(
      v_winners, v_losers, v_sport_enum,
      'tournament'::public.rating_change_source,
      _tournament_match_id,
      NULL
    );
  END IF;

  RETURN v_new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.emit_match_observation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emit_match_observation(uuid) TO authenticated, service_role;

-- 4) Función: revertir observación (deshace deltas del rating ad-hoc)
CREATE OR REPLACE FUNCTION public.revert_match_observation(_tournament_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.match_observation_outbox
    WHERE tournament_match_id = _tournament_match_id AND status = 'emitted'
  ) THEN
    RETURN;
  END IF;

  -- Revertir cada cambio aplicado, en orden inverso (último primero)
  FOR r IN
    SELECT *
      FROM public.rating_history
     WHERE source_ref_id = _tournament_match_id
       AND source = 'tournament'::public.rating_change_source
       AND COALESCE(notes,'') <> 'revert'
     ORDER BY recorded_at DESC
  LOOP
    UPDATE public.player_ratings
       SET level = r.level_before,
           reliability = r.reliability_before,
           matches_played = GREATEST(0, matches_played - 1),
           competitive_matches = GREATEST(0, competitive_matches - 1),
           last_change_delta = -r.delta,
           updated_at = now()
     WHERE user_id = r.user_id AND sport = r.sport;

    INSERT INTO public.rating_history (
      tenant_id, user_id, sport,
      level_before, level_after, delta,
      reliability_before, reliability_after,
      source, source_ref_id, notes
    ) VALUES (
      r.tenant_id, r.user_id, r.sport,
      r.level_after, r.level_before, -r.delta,
      r.reliability_after, r.reliability_before,
      r.source, r.source_ref_id, 'revert'
    );
  END LOOP;

  UPDATE public.match_observation_outbox
     SET status = 'reverted'
   WHERE tournament_match_id = _tournament_match_id AND status = 'emitted';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revert_match_observation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revert_match_observation(uuid) TO authenticated, service_role;

-- 5) Función: corregir resultado (atómica)
CREATE OR REPLACE FUNCTION public.correct_match_result(
  _tournament_match_id uuid,
  _new_score jsonb,
  _new_winner_registration_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _tournament_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % no existe', _tournament_match_id;
  END IF;

  IF NOT public.is_tournament_manager(v_match.tournament_id) THEN
    RAISE EXCEPTION 'No autorizado para corregir resultados de este torneo';
  END IF;

  IF _new_winner_registration_id NOT IN (v_match.registration_a_id, v_match.registration_b_id) THEN
    RAISE EXCEPTION 'El ganador debe ser una de las inscripciones del partido';
  END IF;

  PERFORM public.revert_match_observation(_tournament_match_id);

  UPDATE public.tournament_matches
     SET score = _new_score,
         winner_registration_id = _new_winner_registration_id,
         played_at = now(),
         updated_at = now()
   WHERE id = _tournament_match_id;

  RETURN public.emit_match_observation(_tournament_match_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.correct_match_result(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_match_result(uuid, jsonb, uuid) TO authenticated, service_role;

-- 6) Reemplazar trigger: un único punto de salida
CREATE OR REPLACE FUNCTION public._tg_rating_on_tournament_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text <> 'jugado' THEN RETURN NEW; END IF;
  IF OLD.status::text = 'jugado' THEN RETURN NEW; END IF;
  IF NEW.walkover THEN RETURN NEW; END IF;
  IF NEW.winner_registration_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.registration_a_id IS NULL OR NEW.registration_b_id IS NULL THEN RETURN NEW; END IF;

  PERFORM public.emit_match_observation(NEW.id);
  RETURN NEW;
END;
$$;
