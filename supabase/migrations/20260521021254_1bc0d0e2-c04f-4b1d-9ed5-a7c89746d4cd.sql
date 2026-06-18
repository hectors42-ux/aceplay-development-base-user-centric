
DROP FUNCTION IF EXISTS public.home_pending_actions();

CREATE OR REPLACE FUNCTION public.home_pending_actions()
RETURNS TABLE(
  ladder_challenges_received integer,
  ladder_results_to_confirm integer,
  tournament_results_to_confirm integer,
  doubles_invitations integer,
  reschedule_requests integer,
  partner_results_to_load integer,
  partner_results_to_confirm integer,
  results_to_load integer,
  total integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  ),
  rtl AS (
    SELECT (
      (SELECT count(*) FROM public.ladder_challenges lc
        WHERE lc.status = 'aceptado'
          AND lc.result_proposed_at IS NULL
          AND lc.scheduled_at IS NOT NULL
          AND lc.scheduled_at + INTERVAL '2 hours' < now()
          AND (lc.challenger_user_id = auth.uid() OR lc.challenged_user_id = auth.uid()))
      +
      (SELECT count(*) FROM public.match_invitations mi
        LEFT JOIN public.partner_match_results pr ON pr.invitation_id = mi.id
        WHERE mi.status = 'accepted'
          AND (mi.inviter_user_id = auth.uid() OR mi.invitee_user_id = auth.uid())
          AND mi.selected_slot IS NOT NULL
          AND ((mi.selected_slot->>'starts_at')::timestamptz) + INTERVAL '2 hours' < now()
          AND (pr.invitation_id IS NULL OR pr.status = 'rechazado'))
      +
      (SELECT count(*) FROM public.tournament_matches m
        LEFT JOIN public.tournament_match_results r ON r.match_id = m.id AND r.status IN ('propuesto', 'confirmado')
        WHERE m.scheduled_at IS NOT NULL
          AND m.scheduled_at + INTERVAL '2 hours' < now()
          AND m.winner_registration_id IS NULL
          AND m.walkover = false
          AND r.id IS NULL
          AND public.is_match_player(auth.uid(), m.id))
    )::int AS n
  )
  SELECT
    lcr.n, lrc.n, trc.n, di.n, rsr.n, prl.n, prc.n, rtl.n,
    (lcr.n + lrc.n + trc.n + di.n + rsr.n + prl.n + prc.n + rtl.n) AS total
  FROM lcr, lrc, trc, di, rsr, prl, prc, rtl;
$$;
