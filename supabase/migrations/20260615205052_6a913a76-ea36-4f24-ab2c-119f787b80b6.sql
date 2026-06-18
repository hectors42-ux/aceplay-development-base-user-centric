
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS confirmation_status text,
  ADD COLUMN IF NOT EXISTS reported_by uuid,
  ADD COLUMN IF NOT EXISTS reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS disputed_by uuid,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_reason text;

CREATE INDEX IF NOT EXISTS idx_tournament_matches_pending_confirm
  ON public.tournament_matches (confirmation_status, reported_at)
  WHERE confirmation_status = 'pendiente_confirmacion';

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS auto_confirm_after_minutes int NOT NULL DEFAULT 10;

CREATE OR REPLACE FUNCTION public.submit_americano_result(
  _match_id uuid,
  _winner_side char(1),
  _score jsonb,
  _walkover boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_cat public.tournament_categories%ROWTYPE;
  v_round_id uuid;
  v_pending int;
  v_obs uuid;
  v_is_manager boolean;
  v_is_operator boolean;
  v_conf_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _winner_side NOT IN ('a','b') THEN RAISE EXCEPTION 'winner_side debe ser a o b'; END IF;

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no encontrado'; END IF;
  IF v_match.phase IS DISTINCT FROM 'americano' THEN
    RAISE EXCEPTION 'Este partido no pertenece al motor americano';
  END IF;

  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = v_match.tournament_category_id;

  v_is_manager := public.is_tournament_manager(v_cat.tournament_id);
  v_is_operator := public.is_tournament_operator(v_cat.tournament_id, auth.uid());

  IF NOT (v_is_manager OR v_is_operator) THEN
    RAISE EXCEPTION 'Solo el organizador o un operador del torneo puede cargar resultados';
  END IF;

  v_conf_status := CASE WHEN v_is_manager THEN 'confirmado' ELSE 'pendiente_confirmacion' END;

  UPDATE public.tournament_matches
     SET winner_side = _winner_side,
         score = CASE WHEN _walkover THEN NULL ELSE _score END,
         walkover = _walkover,
         status = 'jugado'::match_status,
         played_at = COALESCE(played_at, now()),
         reported_by = auth.uid(),
         reported_at = now(),
         confirmation_status = v_conf_status,
         confirmed_by = CASE WHEN v_is_manager THEN auth.uid() ELSE NULL END,
         confirmed_at = CASE WHEN v_is_manager THEN now() ELSE NULL END,
         disputed_by = NULL,
         disputed_at = NULL,
         dispute_reason = NULL,
         updated_at = now()
   WHERE id = _match_id;

  v_round_id := v_match.americano_round_id;

  BEGIN
    v_obs := public.emit_match_observation(_match_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'emit_match_observation falló: %', SQLERRM;
  END;

  SELECT COUNT(*) INTO v_pending
    FROM public.tournament_matches
   WHERE americano_round_id = v_round_id
     AND status::text NOT IN ('jugado','walkover','cancelado');

  IF v_pending = 0 THEN
    UPDATE public.americano_rounds
      SET status = 'finalizada', updated_at = now()
    WHERE id = v_round_id;
  ELSE
    UPDATE public.americano_rounds
      SET status = 'en_juego', updated_at = now()
    WHERE id = v_round_id AND status = 'pendiente';
  END IF;

  RETURN _match_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_americano_result(uuid, char, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_americano_result(uuid, char, jsonb, boolean) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.is_match_player(uuid, uuid);
CREATE OR REPLACE FUNCTION public.is_match_player(_match_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_matches m
    WHERE m.id = _match_id
      AND (
        _user_id = ANY (COALESCE(m.side_a_user_ids, ARRAY[]::uuid[]))
        OR _user_id = ANY (COALESCE(m.side_b_user_ids, ARRAY[]::uuid[]))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.player_confirm_result(_match_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no encontrado'; END IF;
  IF NOT public.is_match_player(_match_id, auth.uid()) THEN
    RAISE EXCEPTION 'Solo un jugador del partido puede confirmar';
  END IF;
  IF v_match.confirmation_status IS DISTINCT FROM 'pendiente_confirmacion' THEN
    RAISE EXCEPTION 'El resultado ya no está pendiente';
  END IF;
  IF v_match.reported_by IS NOT NULL AND v_match.reported_by = auth.uid() THEN
    RAISE EXCEPTION 'Quien cargó el resultado no puede confirmarlo';
  END IF;

  UPDATE public.tournament_matches
     SET confirmation_status = 'confirmado',
         confirmed_by = auth.uid(),
         confirmed_at = now(),
         updated_at = now()
   WHERE id = _match_id;

  RETURN _match_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.player_confirm_result(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_confirm_result(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.player_dispute_result(_match_id uuid, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no encontrado'; END IF;
  IF NOT public.is_match_player(_match_id, auth.uid()) THEN
    RAISE EXCEPTION 'Solo un jugador del partido puede disputar';
  END IF;
  IF v_match.confirmation_status NOT IN ('pendiente_confirmacion','confirmado') THEN
    RAISE EXCEPTION 'El resultado ya está disputado';
  END IF;

  UPDATE public.tournament_matches
     SET confirmation_status = 'disputado',
         disputed_by = auth.uid(),
         disputed_at = now(),
         dispute_reason = NULLIF(trim(_reason), ''),
         updated_at = now()
   WHERE id = _match_id;

  RETURN _match_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.player_dispute_result(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_dispute_result(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_confirm_pending_results()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH upd AS (
    UPDATE public.tournament_matches m
       SET confirmation_status = 'confirmado',
           confirmed_at = now(),
           updated_at = now()
      FROM public.tournament_categories c
      JOIN public.tournaments t ON t.id = c.tournament_id
     WHERE m.tournament_category_id = c.id
       AND m.confirmation_status = 'pendiente_confirmacion'
       AND m.reported_at IS NOT NULL
       AND m.reported_at < now() - make_interval(mins => GREATEST(COALESCE(t.auto_confirm_after_minutes, 10), 1))
    RETURNING m.id
  )
  SELECT COUNT(*) INTO v_count FROM upd;
  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_confirm_pending_results() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_confirm_pending_results() TO service_role;

UPDATE public.tournament_matches
   SET confirmation_status = 'confirmado',
       confirmed_at = COALESCE(played_at, updated_at, now())
 WHERE confirmation_status IS NULL
   AND status::text IN ('jugado','walkover');

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-confirm-tournament-results');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-confirm-tournament-results',
  '* * * * *',
  $$ SELECT public.auto_confirm_pending_results(); $$
);
