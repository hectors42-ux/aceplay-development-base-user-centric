
CREATE OR REPLACE FUNCTION public.cancel_partner_match(
  _invitation_id uuid,
  _reason text DEFAULT NULL
)
RETURNS match_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inv public.match_invitations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO _inv FROM public.match_invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitación no encontrada';
  END IF;

  IF _inv.inviter_user_id <> auth.uid() AND _inv.invitee_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'No participas de esta invitación';
  END IF;

  IF _inv.status NOT IN ('accepted','pending') THEN
    RAISE EXCEPTION 'Esta invitación ya no se puede cancelar';
  END IF;

  -- Liberar la reserva asociada (si existe y está activa)
  IF _inv.booking_id IS NOT NULL THEN
    UPDATE public.bookings
      SET status = 'cancelada',
          cancelled_at = now(),
          cancelled_by = auth.uid(),
          notes = COALESCE(notes, '') || CASE WHEN _reason IS NOT NULL THEN ' | Cancelado: ' || _reason ELSE ' | Match cancelado' END
      WHERE id = _inv.booking_id AND status = 'confirmada';
  END IF;

  UPDATE public.match_invitations
    SET status = 'cancelled',
        responded_at = COALESCE(responded_at, now()),
        updated_at = now(),
        message = CASE WHEN _reason IS NOT NULL
                       THEN COALESCE(message, '') || ' | Motivo cancelación: ' || _reason
                       ELSE message END
    WHERE id = _invitation_id
    RETURNING * INTO _inv;

  RETURN _inv;
END;
$$;
