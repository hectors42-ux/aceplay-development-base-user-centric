
CREATE OR REPLACE FUNCTION public.enqueue_partner_match_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count int := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT
      mi.id AS invitation_id,
      mi.tenant_id,
      mi.inviter_user_id,
      mi.invitee_user_id,
      b.id AS booking_id,
      b.starts_at,
      c.name AS court_name
    FROM public.match_invitations mi
    JOIN public.bookings b ON b.id = mi.booking_id
    JOIN public.courts c ON c.id = b.court_id
    WHERE mi.status = 'accepted'
      AND b.status = 'confirmada'
      AND b.starts_at BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_notifications n
        WHERE n.kind = 'partner_match_reminder'
          AND n.ref_id = b.id
      )
  LOOP
    INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, description, link, ref_id)
    VALUES
      (
        rec.tenant_id, rec.inviter_user_id, 'partner_match_reminder',
        'Recordatorio: tu match es mañana',
        'Cancha ' || rec.court_name || ' · ' ||
          to_char(rec.starts_at AT TIME ZONE 'America/Santiago', 'DD/MM HH24:MI') || ' hrs',
        '/partner/match/' || rec.invitation_id::text,
        rec.booking_id
      ),
      (
        rec.tenant_id, rec.invitee_user_id, 'partner_match_reminder',
        'Recordatorio: tu match es mañana',
        'Cancha ' || rec.court_name || ' · ' ||
          to_char(rec.starts_at AT TIME ZONE 'America/Santiago', 'DD/MM HH24:MI') || ' hrs',
        '/partner/match/' || rec.invitation_id::text,
        rec.booking_id
      );
    inserted_count := inserted_count + 2;
  END LOOP;

  RETURN jsonb_build_object('inserted', inserted_count, 'ran_at', now());
END;
$$;
