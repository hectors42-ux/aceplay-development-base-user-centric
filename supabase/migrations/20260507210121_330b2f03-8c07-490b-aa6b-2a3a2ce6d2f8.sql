
CREATE OR REPLACE FUNCTION public.user_partner_match_events(_user_id uuid, _limit integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_tenant uuid;
  v_target_tenant uuid;
  v_events jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT tenant_id INTO v_target_tenant FROM public.profiles WHERE user_id = _user_id LIMIT 1;
  IF v_target_tenant IS NULL THEN
    RETURN jsonb_build_object('events', '[]'::jsonb);
  END IF;

  SELECT tenant_id INTO v_caller_tenant FROM public.profiles WHERE user_id = v_caller LIMIT 1;
  IF v_caller_tenant <> v_target_tenant AND NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Solo el propio usuario (o super_admin) puede ver el detalle de sus invitaciones
  IF v_caller <> _user_id AND NOT public.is_super_admin(v_caller) THEN
    RETURN jsonb_build_object('events', '[]'::jsonb);
  END IF;

  WITH base AS (
    SELECT
      mi.id AS invitation_id,
      mi.status,
      mi.created_at,
      mi.responded_at,
      mi.updated_at,
      mi.booking_id,
      CASE WHEN mi.inviter_user_id = _user_id THEN mi.invitee_user_id ELSE mi.inviter_user_id END AS opponent_id,
      (mi.inviter_user_id = _user_id) AS is_inviter,
      b.starts_at AS booking_starts_at,
      b.status AS booking_status,
      b.cancelled_at AS booking_cancelled_at,
      c.name AS court_name
    FROM public.match_invitations mi
    LEFT JOIN public.bookings b ON b.id = mi.booking_id
    LEFT JOIN public.courts c ON c.id = b.court_id
    WHERE mi.tenant_id = v_target_tenant
      AND (mi.inviter_user_id = _user_id OR mi.invitee_user_id = _user_id)
  ),
  exploded AS (
    SELECT invitation_id, opponent_id, court_name, booking_starts_at,
           'created'::text AS kind, created_at AS at, is_inviter
    FROM base
    UNION ALL
    SELECT invitation_id, opponent_id, court_name, booking_starts_at,
           CASE WHEN status = 'accepted' THEN 'accepted'
                WHEN status = 'rejected' THEN 'rejected'
                WHEN status = 'cancelled' THEN 'cancelled'
                WHEN status = 'expired' THEN 'expired'
                ELSE NULL END AS kind,
           responded_at AS at, is_inviter
    FROM base
    WHERE responded_at IS NOT NULL AND status <> 'pending'
    UNION ALL
    SELECT invitation_id, opponent_id, court_name, booking_starts_at,
           'booked'::text AS kind, COALESCE(booking_starts_at, updated_at) AS at, is_inviter
    FROM base
    WHERE booking_id IS NOT NULL AND booking_status = 'confirmada'
    UNION ALL
    SELECT invitation_id, opponent_id, court_name, booking_starts_at,
           'booking_cancelled'::text AS kind, booking_cancelled_at AS at, is_inviter
    FROM base
    WHERE booking_cancelled_at IS NOT NULL
  ),
  filtered AS (
    SELECT e.*,
           (SELECT first_name || ' ' || last_name FROM public.profiles p WHERE p.user_id = e.opponent_id) AS opponent_name
    FROM exploded e
    WHERE e.kind IS NOT NULL AND e.at IS NOT NULL
    ORDER BY e.at DESC
    LIMIT GREATEST(LEAST(_limit, 100), 1)
  )
  SELECT COALESCE(jsonb_agg(row_to_json(filtered)::jsonb), '[]'::jsonb)
    INTO v_events
  FROM filtered;

  RETURN jsonb_build_object('events', v_events);
END;
$$;
