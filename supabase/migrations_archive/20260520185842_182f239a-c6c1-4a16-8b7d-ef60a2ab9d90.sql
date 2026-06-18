CREATE OR REPLACE FUNCTION public.user_match_history(_user_id uuid, _limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_tenant uuid;
  v_target_tenant uuid;
  v_is_self boolean;
  v_effective_limit integer;
  v_played jsonb;
  v_pending_tournaments jsonb;
  v_pending_ladder jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT tenant_id INTO v_target_tenant FROM public.profiles WHERE user_id = _user_id LIMIT 1;
  IF v_target_tenant IS NULL THEN
    RETURN jsonb_build_object('played', '[]'::jsonb, 'pending_tournaments', '[]'::jsonb, 'pending_ladder', '[]'::jsonb);
  END IF;

  SELECT tenant_id INTO v_caller_tenant FROM public.profiles WHERE user_id = v_caller LIMIT 1;
  IF v_caller_tenant <> v_target_tenant AND NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_is_self := (v_caller = _user_id);
  v_effective_limit := CASE WHEN v_is_self THEN LEAST(GREATEST(_limit, 1), 50) ELSE 10 END;

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.recorded_at DESC), '[]'::jsonb)
    INTO v_played
  FROM (
    SELECT
      rh.id,
      rh.recorded_at,
      rh.delta,
      rh.level_after,
      rh.source::text AS source,
      rh.source_ref_id,
      CASE
        WHEN rh.source = 'ladder_challenge' THEN (
          SELECT CASE WHEN lc.challenger_user_id = _user_id THEN lc.challenged_user_id ELSE lc.challenger_user_id END
          FROM public.ladder_challenges lc WHERE lc.id = rh.source_ref_id
        )
        WHEN rh.source = 'tournament_match' THEN (
          SELECT CASE
            WHEN tr_a.player1_user_id = _user_id OR tr_a.player2_user_id = _user_id THEN COALESCE(tr_b.player1_user_id, tr_b.player2_user_id)
            ELSE COALESCE(tr_a.player1_user_id, tr_a.player2_user_id)
          END
          FROM public.tournament_matches tm
          LEFT JOIN public.tournament_registrations tr_a ON tr_a.id = tm.registration_a_id
          LEFT JOIN public.tournament_registrations tr_b ON tr_b.id = tm.registration_b_id
          WHERE tm.id = rh.source_ref_id
        )
        WHEN rh.source = 'open_match' THEN NULL
        ELSE NULL
      END AS opponent_id,
      CASE
        WHEN rh.source = 'ladder_challenge' THEN (
          SELECT lc.score FROM public.ladder_challenges lc WHERE lc.id = rh.source_ref_id
        )
        WHEN rh.source = 'tournament_match' THEN (
          SELECT to_jsonb(tmr.score) FROM public.tournament_match_results tmr
          WHERE tmr.match_id = rh.source_ref_id AND tmr.status = 'confirmado'
          ORDER BY tmr.responded_at DESC NULLS LAST LIMIT 1
        )
        ELSE NULL
      END AS score,
      (rh.delta > 0) AS won
    FROM public.rating_history rh
    WHERE rh.user_id = _user_id
      AND rh.tenant_id = v_target_tenant
    ORDER BY rh.recorded_at DESC
    LIMIT v_effective_limit
  ) x;

  IF v_is_self THEN
    SELECT COALESCE(jsonb_agg(row_to_json(y)::jsonb ORDER BY y.scheduled_at NULLS LAST, y.created_at DESC), '[]'::jsonb)
      INTO v_pending_tournaments
    FROM (
      SELECT
        tm.id AS match_id,
        tm.scheduled_at,
        tm.created_at,
        tm.round,
        tc.id AS category_id,
        tc.name AS category_name,
        t.slug AS tournament_slug,
        t.name AS tournament_name,
        CASE
          WHEN tr_a.player1_user_id = _user_id OR tr_a.player2_user_id = _user_id THEN (
            COALESCE((SELECT first_name||' '||last_name FROM public.profiles WHERE user_id = tr_b.player1_user_id), 'Jugador') ||
            CASE WHEN tr_b.player2_user_id IS NOT NULL THEN ' / '||COALESCE((SELECT first_name||' '||last_name FROM public.profiles WHERE user_id = tr_b.player2_user_id), '') ELSE '' END
          )
          ELSE (
            COALESCE((SELECT first_name||' '||last_name FROM public.profiles WHERE user_id = tr_a.player1_user_id), 'Jugador') ||
            CASE WHEN tr_a.player2_user_id IS NOT NULL THEN ' / '||COALESCE((SELECT first_name||' '||last_name FROM public.profiles WHERE user_id = tr_a.player2_user_id), '') ELSE '' END
          )
        END AS opponent_name,
        EXISTS (
          SELECT 1 FROM public.tournament_match_results tmr
          WHERE tmr.match_id = tm.id AND tmr.status = 'propuesto'
        ) AS has_pending_proposal,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.tournament_match_results tmr
            WHERE tmr.match_id = tm.id AND tmr.status = 'propuesto' AND tmr.proposed_by = _user_id
          ) THEN 'wait'
          WHEN EXISTS (
            SELECT 1 FROM public.tournament_match_results tmr
            WHERE tmr.match_id = tm.id AND tmr.status = 'propuesto' AND tmr.proposed_by <> _user_id
          ) THEN 'confirm'
          ELSE 'submit'
        END AS needs_action
      FROM public.tournament_matches tm
      JOIN public.tournament_categories tc ON tc.id = tm.category_id
      JOIN public.tournaments t ON t.id = tm.tournament_id
      LEFT JOIN public.tournament_registrations tr_a ON tr_a.id = tm.registration_a_id
      LEFT JOIN public.tournament_registrations tr_b ON tr_b.id = tm.registration_b_id
      WHERE tm.tenant_id = v_target_tenant
        AND tm.status IN ('pendiente', 'programado')
        AND tm.registration_a_id IS NOT NULL
        AND tm.registration_b_id IS NOT NULL
        AND (
          tr_a.player1_user_id = _user_id OR tr_a.player2_user_id = _user_id
          OR tr_b.player1_user_id = _user_id OR tr_b.player2_user_id = _user_id
        )
      ORDER BY tm.scheduled_at NULLS LAST, tm.created_at DESC
      LIMIT 30
    ) y;

    SELECT COALESCE(jsonb_agg(row_to_json(z)::jsonb ORDER BY z.scheduled_at NULLS LAST, z.created_at DESC), '[]'::jsonb)
      INTO v_pending_ladder
    FROM (
      SELECT
        lc.id AS challenge_id,
        lc.scheduled_at,
        lc.created_at,
        lc.status::text AS status,
        lc.result_proposed_by,
        lc.result_proposed_at,
        l.id AS ladder_id,
        l.name AS ladder_name,
        CASE WHEN lc.challenger_user_id = _user_id THEN lc.challenged_user_id ELSE lc.challenger_user_id END AS opponent_id,
        (
          SELECT first_name||' '||last_name FROM public.profiles
          WHERE user_id = CASE WHEN lc.challenger_user_id = _user_id THEN lc.challenged_user_id ELSE lc.challenger_user_id END
        ) AS opponent_name,
        CASE
          WHEN lc.result_proposed_by IS NOT NULL AND lc.result_proposed_by <> _user_id THEN 'confirm'
          WHEN lc.result_proposed_by IS NULL THEN 'submit'
          ELSE 'wait'
        END AS needs_action
      FROM public.ladder_challenges lc
      JOIN public.ladders l ON l.id = lc.ladder_id
      WHERE lc.tenant_id = v_target_tenant
        AND lc.status IN ('aceptado', 'programado')
        AND (lc.challenger_user_id = _user_id OR lc.challenged_user_id = _user_id)
      ORDER BY lc.scheduled_at NULLS LAST, lc.created_at DESC
      LIMIT 30
    ) z;
  ELSE
    v_pending_tournaments := '[]'::jsonb;
    v_pending_ladder := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'played', COALESCE(v_played, '[]'::jsonb),
    'pending_tournaments', COALESCE(v_pending_tournaments, '[]'::jsonb),
    'pending_ladder', COALESCE(v_pending_ladder, '[]'::jsonb),
    'is_self', v_is_self,
    'limit', v_effective_limit
  );
END;
$function$;