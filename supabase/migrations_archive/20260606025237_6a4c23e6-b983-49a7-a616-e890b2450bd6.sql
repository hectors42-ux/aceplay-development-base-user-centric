
-- PII minimization for bookings (Ley 21.719):
-- Members in the same tenant can still see WHEN and ON WHICH COURT another
-- member is playing (needed for booking coordination), but free-text notes
-- and the cancelled_by identity are restricted to the owner, partner,
-- and club admins via public.get_booking_sensitive(_booking_id).
REVOKE SELECT (notes, cancelled_by, cancelled_at) ON public.bookings FROM authenticated, anon;

-- Re-grant SELECT only on the non-sensitive columns
GRANT SELECT (
  id, tenant_id, court_id, user_id, starts_at, ends_at, status,
  partner_user_id, kind, period, created_at
) ON public.bookings TO authenticated;
