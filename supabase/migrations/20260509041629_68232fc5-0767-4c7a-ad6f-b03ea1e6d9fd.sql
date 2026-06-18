
DROP FUNCTION IF EXISTS public.home_pending_actions();

-- 1. Tabla
CREATE TABLE public.partner_match_results (
  invitation_id uuid PRIMARY KEY REFERENCES public.match_invitations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  winner_user_id uuid NOT NULL,
  loser_user_id uuid NOT NULL,
  score jsonb,
  walkover boolean NOT NULL DEFAULT false,
  retired boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'propuesto',
  proposed_by uuid NOT NULL,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  confirmed_by uuid,
  rejected_at timestamptz,
  rejected_by uuid,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_match_results_status_chk CHECK (status IN ('propuesto','confirmado','rechazado'))
);

CREATE INDEX idx_pmr_tenant ON public.partner_match_results(tenant_id);
CREATE INDEX idx_pmr_winner ON public.partner_match_results(winner_user_id);
CREATE INDEX idx_pmr_loser ON public.partner_match_results(loser_user_id);

ALTER TABLE public.partner_match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY pmr_parties_read ON public.partner_match_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.match_invitations mi
      WHERE mi.id = invitation_id
        AND (mi.inviter_user_id = auth.uid() OR mi.invitee_user_id = auth.uid())
    )
    OR is_club_admin_of(auth.uid(), tenant_id)
    OR is_super_admin(auth.uid())
  );

CREATE POLICY pmr_admin_all ON public.partner_match_results
  FOR ALL TO authenticated
  USING (is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

CREATE TRIGGER pmr_set_updated_at
  BEFORE UPDATE ON public.partner_match_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. recalculate_rating_after_match con multiplicador K
CREATE OR REPLACE FUNCTION public.recalculate_rating_after_match(
  _user_id uuid,
  _opponent_level numeric,
  _won boolean,
  _sport rating_sport,
  _source rating_change_source,
  _source_ref_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL,
  _k_multiplier numeric DEFAULT 1.0
)
RETURNS player_ratings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rating public.player_ratings;
  v_config public.tenant_rating_config;
  v_k NUMERIC;
  v_expected NUMERIC;
  v_actual NUMERIC;
  v_delta NUMERIC;
  v_new_level NUMERIC;
  v_new_reliability INTEGER;
  v_level_before NUMERIC;
  v_reliability_before INTEGER;
BEGIN
  SELECT * INTO v_rating FROM public.player_ratings WHERE user_id = _user_id AND sport = _sport LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player rating not found for user % sport %', _user_id, _sport;
  END IF;

  SELECT * INTO v_config FROM public.tenant_rating_config WHERE tenant_id = v_rating.tenant_id;
  IF NOT FOUND THEN
    v_config.k_factor_low_reliability := 0.20;
    v_config.k_factor_mid_reliability := 0.10;
    v_config.k_factor_high_reliability := 0.05;
    v_config.reliability_gain_per_match := 4;
  END IF;

  IF v_rating.reliability < 30 THEN
    v_k := v_config.k_factor_low_reliability;
  ELSIF v_rating.reliability < 70 THEN
    v_k := v_config.k_factor_mid_reliability;
  ELSE
    v_k := v_config.k_factor_high_reliability;
  END IF;

  v_k := v_k * COALESCE(_k_multiplier, 1.0);

  v_expected := 1.0 / (1.0 + power(10, (_opponent_level - v_rating.level) / 1.0));
  v_actual := CASE WHEN _won THEN 1.0 ELSE 0.0 END;
  v_delta := round((v_k * (v_actual - v_expected))::numeric, 4);

  v_level_before := v_rating.level;
  v_reliability_before := v_rating.reliability;

  v_new_level := GREATEST(0, LEAST(7, v_rating.level + v_delta));
  v_new_reliability := LEAST(100, v_rating.reliability + v_config.reliability_gain_per_match);

  UPDATE public.player_ratings
     SET level = v_new_level,
         reliability = v_new_reliability,
         matches_played = matches_played + 1,
         competitive_matches = competitive_matches + 1,
         last_match_at = now(),
         last_change_delta = v_delta,
         updated_at = now()
   WHERE id = v_rating.id
   RETURNING * INTO v_rating;

  INSERT INTO public.rating_history (
    tenant_id, user_id, sport,
    level_before, level_after, delta,
    reliability_before, reliability_after,
    source, source_ref_id, notes
  ) VALUES (
    v_rating.tenant_id, _user_id, _sport,
    v_level_before, v_new_level, v_delta,
    v_reliability_before, v_new_reliability,
    _source, _source_ref_id, _notes
  );

  RETURN v_rating;
END;
$function$;

-- 3. Aplicar rating del amistoso (k * 0.5)
CREATE OR REPLACE FUNCTION public._apply_partner_match_rating(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_res public.partner_match_results%ROWTYPE;
  v_winner_level numeric;
  v_loser_level numeric;
BEGIN
  SELECT * INTO v_res FROM public.partner_match_results WHERE invitation_id = _invitation_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_res.walkover THEN RETURN; END IF;

  SELECT level INTO v_winner_level FROM public.player_ratings
    WHERE user_id = v_res.winner_user_id AND sport = 'tenis_singles' LIMIT 1;
  SELECT level INTO v_loser_level FROM public.player_ratings
    WHERE user_id = v_res.loser_user_id AND sport = 'tenis_singles' LIMIT 1;

  IF v_winner_level IS NOT NULL AND v_loser_level IS NOT NULL THEN
    PERFORM public.recalculate_rating_after_match(
      v_res.winner_user_id, v_loser_level, true,
      'tenis_singles'::rating_sport, 'open_match'::rating_change_source,
      _invitation_id, 'partner_match k×0.5', 0.5
    );
    PERFORM public.recalculate_rating_after_match(
      v_res.loser_user_id, v_winner_level, false,
      'tenis_singles'::rating_sport, 'open_match'::rating_change_source,
      _invitation_id, 'partner_match k×0.5', 0.5
    );
  END IF;
END;
$function$;

-- 4. submit_partner_match_result
CREATE OR REPLACE FUNCTION public.submit_partner_match_result(
  _invitation_id uuid,
  _winner_user_id uuid,
  _score jsonb DEFAULT NULL,
  _walkover boolean DEFAULT false,
  _retired boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_inv public.match_invitations%ROWTYPE;
  v_starts_at timestamptz;
  v_loser uuid;
  v_existing public.partner_match_results%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_inv FROM public.match_invitations WHERE id = _invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitación no encontrada'; END IF;

  IF v_user NOT IN (v_inv.inviter_user_id, v_inv.invitee_user_id) THEN
    RAISE EXCEPTION 'Solo los jugadores del partido pueden cargar el resultado';
  END IF;

  IF v_inv.status <> 'accepted' THEN
    RAISE EXCEPTION 'La invitación no está aceptada';
  END IF;

  v_starts_at := (v_inv.selected_slot->>'starts_at')::timestamptz;
  IF v_starts_at IS NULL OR v_starts_at > now() THEN
    RAISE EXCEPTION 'El partido aún no se ha jugado';
  END IF;

  IF _winner_user_id NOT IN (v_inv.inviter_user_id, v_inv.invitee_user_id) THEN
    RAISE EXCEPTION 'El ganador debe ser uno de los jugadores';
  END IF;

  v_loser := CASE WHEN _winner_user_id = v_inv.inviter_user_id THEN v_inv.invitee_user_id ELSE v_inv.inviter_user_id END;

  SELECT * INTO v_existing FROM public.partner_match_results WHERE invitation_id = _invitation_id;

  IF FOUND AND v_existing.status = 'confirmado' THEN
    RAISE EXCEPTION 'El resultado ya está confirmado';
  END IF;

  IF FOUND THEN
    UPDATE public.partner_match_results
       SET winner_user_id = _winner_user_id,
           loser_user_id = v_loser,
           score = _score,
           walkover = COALESCE(_walkover,false),
           retired = COALESCE(_retired,false),
           status = 'propuesto',
           proposed_by = v_user,
           proposed_at = now(),
           confirmed_at = NULL, confirmed_by = NULL,
           rejected_at = NULL, rejected_by = NULL, reject_reason = NULL,
           updated_at = now()
     WHERE invitation_id = _invitation_id;
  ELSE
    INSERT INTO public.partner_match_results(
      invitation_id, tenant_id, winner_user_id, loser_user_id,
      score, walkover, retired, status, proposed_by
    ) VALUES (
      _invitation_id, v_inv.tenant_id, _winner_user_id, v_loser,
      _score, COALESCE(_walkover,false), COALESCE(_retired,false), 'propuesto', v_user
    );
  END IF;

  RETURN jsonb_build_object('status','pending_confirmation');
END;
$function$;

-- 5. confirm_partner_match_result
CREATE OR REPLACE FUNCTION public.confirm_partner_match_result(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_inv public.match_invitations%ROWTYPE;
  v_res public.partner_match_results%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_res FROM public.partner_match_results WHERE invitation_id = _invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No hay resultado propuesto'; END IF;
  IF v_res.status = 'confirmado' THEN RAISE EXCEPTION 'Ya está confirmado'; END IF;

  SELECT * INTO v_inv FROM public.match_invitations WHERE id = _invitation_id;
  IF v_user NOT IN (v_inv.inviter_user_id, v_inv.invitee_user_id) THEN
    RAISE EXCEPTION 'Solo los jugadores del partido pueden confirmar';
  END IF;
  IF v_user = v_res.proposed_by THEN
    RAISE EXCEPTION 'No puedes confirmar tu propia propuesta';
  END IF;

  UPDATE public.partner_match_results
     SET status = 'confirmado',
         confirmed_at = now(),
         confirmed_by = v_user,
         updated_at = now()
   WHERE invitation_id = _invitation_id;

  PERFORM public._apply_partner_match_rating(_invitation_id);

  RETURN jsonb_build_object('status','applied');
END;
$function$;

-- 6. reject_partner_match_result
CREATE OR REPLACE FUNCTION public.reject_partner_match_result(_invitation_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_inv public.match_invitations%ROWTYPE;
  v_res public.partner_match_results%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_res FROM public.partner_match_results WHERE invitation_id = _invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No hay resultado propuesto'; END IF;
  IF v_res.status <> 'propuesto' THEN RAISE EXCEPTION 'Solo se puede rechazar un resultado propuesto'; END IF;

  SELECT * INTO v_inv FROM public.match_invitations WHERE id = _invitation_id;
  IF v_user NOT IN (v_inv.inviter_user_id, v_inv.invitee_user_id) THEN
    RAISE EXCEPTION 'Solo los jugadores pueden rechazar';
  END IF;
  IF v_user = v_res.proposed_by THEN
    RAISE EXCEPTION 'No puedes rechazar tu propia propuesta';
  END IF;

  UPDATE public.partner_match_results
     SET status = 'rechazado',
         rejected_at = now(),
         rejected_by = v_user,
         reject_reason = _reason,
         updated_at = now()
   WHERE invitation_id = _invitation_id;

  RETURN jsonb_build_object('status','rejected');
END;
$function$;

-- 7. home_pending_actions extendido
CREATE OR REPLACE FUNCTION public.home_pending_actions()
RETURNS TABLE(
  ladder_challenges_received integer,
  ladder_results_to_confirm integer,
  tournament_results_to_confirm integer,
  doubles_invitations integer,
  reschedule_requests integer,
  partner_results_to_load integer,
  partner_results_to_confirm integer,
  total integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH lcr AS (
    SELECT count(*)::int AS n FROM public.ladder_challenges
    WHERE challenged_user_id = auth.uid() AND status = 'propuesto'
  ),
  lrc AS (
    SELECT count(*)::int AS n FROM public.ladder_challenges
    WHERE result_proposed_at IS NOT NULL
      AND result_confirmed_at IS NULL
      AND result_proposed_by IS DISTINCT FROM auth.uid()
      AND (challenger_user_id = auth.uid() OR challenged_user_id = auth.uid())
  ),
  trc AS (
    SELECT count(*)::int AS n
    FROM public.tournament_match_results r
    JOIN public.tournament_matches m ON m.id = r.match_id
    WHERE r.status = 'propuesto'
      AND r.proposed_by IS DISTINCT FROM auth.uid()
      AND public.is_match_player(m.id, auth.uid())
  ),
  di AS (
    SELECT count(*)::int AS n FROM public.tournament_registrations
    WHERE player2_user_id = auth.uid() AND status = 'pendiente_pareja'
  ),
  rsr AS (
    SELECT count(*)::int AS n
    FROM public.tournament_match_reschedule_requests rr
    JOIN public.tournament_matches m ON m.id = rr.match_id
    WHERE rr.status = 'pendiente'
      AND rr.proposed_by IS DISTINCT FROM auth.uid()
      AND public.is_match_player(m.id, auth.uid())
  ),
  prl AS (
    SELECT count(*)::int AS n FROM public.match_invitations mi
    LEFT JOIN public.partner_match_results pr ON pr.invitation_id = mi.id
    WHERE mi.status = 'accepted'
      AND (mi.inviter_user_id = auth.uid() OR mi.invitee_user_id = auth.uid())
      AND ((mi.selected_slot->>'starts_at')::timestamptz) < now()
      AND (pr.invitation_id IS NULL OR pr.status = 'rechazado')
  ),
  prc AS (
    SELECT count(*)::int AS n FROM public.partner_match_results pr
    JOIN public.match_invitations mi ON mi.id = pr.invitation_id
    WHERE pr.status = 'propuesto'
      AND pr.proposed_by IS DISTINCT FROM auth.uid()
      AND (mi.inviter_user_id = auth.uid() OR mi.invitee_user_id = auth.uid())
  )
  SELECT
    lcr.n, lrc.n, trc.n, di.n, rsr.n, prl.n, prc.n,
    (lcr.n + lrc.n + trc.n + di.n + rsr.n + prl.n + prc.n) AS total
  FROM lcr, lrc, trc, di, rsr, prl, prc;
$function$;
