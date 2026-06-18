
-- ============================================================
-- Vista tournament_finance
-- ============================================================
DROP VIEW IF EXISTS public.tournament_finance;
CREATE VIEW public.tournament_finance
WITH (security_invoker = on)
AS
SELECT
  tc.id AS category_id,
  tc.tournament_id,
  tc.tenant_id,
  tc.entry_fee_clp,
  COUNT(*) FILTER (WHERE tr.status = 'confirmada')::int AS total_count,
  COUNT(*) FILTER (WHERE tr.status = 'confirmada' AND tr.fee_paid_at IS NOT NULL)::int AS paid_count,
  COALESCE(SUM(
    CASE
      WHEN tr.status = 'confirmada' AND tr.fee_paid_at IS NOT NULL
        THEN COALESCE(tr.fee_amount_clp, tc.entry_fee_clp)
      ELSE 0
    END
  ), 0)::bigint AS collected_clp,
  (tc.entry_fee_clp * COUNT(*) FILTER (WHERE tr.status = 'confirmada'))::bigint AS expected_clp
FROM public.tournament_categories tc
LEFT JOIN public.tournament_registrations tr
  ON tr.tournament_category_id = tc.id
GROUP BY tc.id, tc.tournament_id, tc.tenant_id, tc.entry_fee_clp;

GRANT SELECT ON public.tournament_finance TO authenticated;

-- ============================================================
-- toggle_registration_fee
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_registration_fee(
  _registration_id uuid,
  _paid boolean,
  _method text DEFAULT 'transferencia'
)
RETURNS public.tournament_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_reg public.tournament_registrations%ROWTYPE;
  v_cat public.tournament_categories%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_reg FROM public.tournament_registrations WHERE id = _registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inscripción no encontrada'; END IF;

  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = v_reg.tournament_category_id;
  IF NOT public.is_tournament_manager(v_cat.tournament_id) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  IF _paid THEN
    IF _method IS NULL OR _method NOT IN ('transferencia','efectivo','exento') THEN
      RAISE EXCEPTION 'Método inválido';
    END IF;
    UPDATE public.tournament_registrations
       SET fee_paid_at = now(),
           fee_amount_clp = CASE WHEN _method = 'exento' THEN 0 ELSE v_cat.entry_fee_clp END,
           fee_method = _method
     WHERE id = _registration_id
     RETURNING * INTO v_reg;
  ELSE
    UPDATE public.tournament_registrations
       SET fee_paid_at = NULL, fee_amount_clp = NULL, fee_method = NULL
     WHERE id = _registration_id
     RETURNING * INTO v_reg;
  END IF;

  RETURN v_reg;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.toggle_registration_fee(uuid, boolean, text) TO authenticated;

-- ============================================================
-- close_by_deadline
-- ============================================================
CREATE OR REPLACE FUNCTION public.close_by_deadline(_category_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cat public.tournament_categories%ROWTYPE;
  v_cancelled int := 0;
  v_played int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = _category_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;

  IF NOT public.is_tournament_manager(v_cat.tournament_id) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;
  IF v_cat.close_mode <> 'deadline' THEN
    RAISE EXCEPTION 'La categoría no es de modo deadline';
  END IF;
  IF v_cat.deadline_at IS NULL OR v_cat.deadline_at > now() THEN
    RAISE EXCEPTION 'El deadline aún no se cumple';
  END IF;
  IF v_cat.status = 'finalizado' THEN
    RAISE EXCEPTION 'La categoría ya está finalizada';
  END IF;

  WITH upd AS (
    UPDATE public.tournament_matches
       SET status = 'cancelado'::public.match_status
     WHERE tournament_category_id = _category_id
       AND status IN ('pendiente','programado','interrumpido')
     RETURNING 1
  )
  SELECT count(*) INTO v_cancelled FROM upd;

  SELECT count(*) INTO v_played
  FROM public.tournament_matches
  WHERE tournament_category_id = _category_id
    AND status IN ('jugado','walkover');

  UPDATE public.tournament_categories
     SET status = 'finalizado'
   WHERE id = _category_id;

  RETURN jsonb_build_object('cancelled', v_cancelled, 'played', v_played);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.close_by_deadline(uuid) TO authenticated;

-- ============================================================
-- Trigger: cierre automático en modo fixture
-- ============================================================
CREATE OR REPLACE FUNCTION public._tg_close_by_fixture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cat public.tournament_categories%ROWTYPE;
  v_pending int;
BEGIN
  IF NEW.status NOT IN ('jugado','walkover','cancelado') THEN
    RETURN NEW;
  END IF;
  IF NEW.tournament_category_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_cat FROM public.tournament_categories
   WHERE id = NEW.tournament_category_id;
  IF NOT FOUND OR v_cat.close_mode <> 'fixture' THEN RETURN NEW; END IF;
  IF v_cat.bracket_generated_at IS NULL THEN RETURN NEW; END IF;
  IF v_cat.status = 'finalizado' THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_pending
  FROM public.tournament_matches
  WHERE tournament_category_id = NEW.tournament_category_id
    AND status NOT IN ('jugado','walkover','cancelado');

  IF v_pending = 0 THEN
    UPDATE public.tournament_categories
       SET status = 'finalizado'
     WHERE id = NEW.tournament_category_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_close_by_fixture ON public.tournament_matches;
CREATE TRIGGER trg_close_by_fixture
  AFTER UPDATE OF status ON public.tournament_matches
  FOR EACH ROW EXECUTE FUNCTION public._tg_close_by_fixture();

-- ============================================================
-- evaluate_dominant_rule (helper genérico)
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_dominant_rule(
  _score jsonb,
  _rules jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  v_min_total int := COALESCE((_rules->>'min_total_games')::int, 10);
  v_lead_min  int := COALESCE((_rules->>'lead_min_games')::int, 4);
  v_loser_max numeric := COALESCE((_rules->>'loser_max_share')::numeric, 0.5);
  v_sets jsonb;
  v_set1 jsonb;
  v_set2 jsonb;
  v_a int := 0;
  v_b int := 0;
  v_winner_side text;
  v_w int;
  v_l int;
BEGIN
  IF _score IS NULL THEN
    RETURN jsonb_build_object('applies', false, 'reason', 'no_score');
  END IF;
  v_sets := COALESCE(_score->'sets', _score);
  IF jsonb_typeof(v_sets) <> 'array' OR jsonb_array_length(v_sets) < 1 THEN
    RETURN jsonb_build_object('applies', false, 'reason', 'no_sets');
  END IF;

  v_set1 := v_sets->0;
  IF (v_set1->>'a')::int = (v_set1->>'b')::int THEN
    RETURN jsonb_build_object('applies', false, 'reason', 'set1_tied');
  END IF;
  v_winner_side := CASE WHEN (v_set1->>'a')::int > (v_set1->>'b')::int THEN 'a' ELSE 'b' END;

  IF jsonb_array_length(v_sets) < 2 THEN
    RETURN jsonb_build_object('applies', false, 'reason', 'no_set2', 'winner_side', v_winner_side);
  END IF;
  v_set2 := v_sets->1;

  -- Lidera set 2
  IF v_winner_side = 'a' AND (v_set2->>'a')::int <= (v_set2->>'b')::int THEN
    RETURN jsonb_build_object('applies', false, 'reason', 'not_leading_set2');
  END IF;
  IF v_winner_side = 'b' AND (v_set2->>'b')::int <= (v_set2->>'a')::int THEN
    RETURN jsonb_build_object('applies', false, 'reason', 'not_leading_set2');
  END IF;

  v_a := (v_set1->>'a')::int + (v_set2->>'a')::int;
  v_b := (v_set1->>'b')::int + (v_set2->>'b')::int;

  IF v_winner_side = 'a' THEN
    v_w := v_a; v_l := v_b;
  ELSE
    v_w := v_b; v_l := v_a;
  END IF;

  IF (v_w + v_l) < v_min_total THEN
    RETURN jsonb_build_object('applies', false, 'reason', 'few_total_games',
      'totals', jsonb_build_object('w', v_w, 'l', v_l));
  END IF;
  IF (v_w - v_l) < v_lead_min THEN
    RETURN jsonb_build_object('applies', false, 'reason', 'small_lead');
  END IF;
  IF (v_w + v_l) > 0 AND (v_l::numeric / (v_w + v_l)::numeric) > v_loser_max THEN
    RETURN jsonb_build_object('applies', false, 'reason', 'loser_share_high');
  END IF;

  -- Completar set 2 a 6 para el ganador (manteniendo juegos del perdedor en ese set)
  DECLARE
    v_final_sets jsonb;
    v_final_set2 jsonb;
  BEGIN
    IF v_winner_side = 'a' THEN
      v_final_set2 := jsonb_build_object(
        'a', GREATEST(6, (v_set2->>'a')::int),
        'b', (v_set2->>'b')::int,
        'kind', 'set'
      );
    ELSE
      v_final_set2 := jsonb_build_object(
        'a', (v_set2->>'a')::int,
        'b', GREATEST(6, (v_set2->>'b')::int),
        'kind', 'set'
      );
    END IF;

    v_final_sets := jsonb_build_array(v_set1, v_final_set2);

    RETURN jsonb_build_object(
      'applies', true,
      'winner_side', v_winner_side,
      'reason', 'dominant_rule',
      'final_score', jsonb_build_object('sets', v_final_sets)
    );
  END;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.evaluate_dominant_rule(jsonb, jsonb) TO authenticated;
