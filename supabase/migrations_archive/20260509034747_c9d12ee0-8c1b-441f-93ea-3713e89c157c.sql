DROP FUNCTION IF EXISTS public.my_upcoming_bookings(int);

CREATE OR REPLACE FUNCTION public.my_upcoming_bookings(_limit int DEFAULT 5)
RETURNS TABLE (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status booking_status,
  kind booking_kind,
  court_id uuid,
  court_name text,
  court_surface court_surface,
  user_id uuid,
  partner_user_id uuid,
  other_first_name text,
  other_last_name text,
  i_am_owner boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.starts_at,
    b.ends_at,
    b.status,
    b.kind,
    b.court_id,
    c.name AS court_name,
    c.surface AS court_surface,
    b.user_id,
    b.partner_user_id,
    p_other.first_name AS other_first_name,
    p_other.last_name  AS other_last_name,
    (b.user_id = auth.uid()) AS i_am_owner
  FROM public.bookings b
  JOIN public.courts c ON c.id = b.court_id
  LEFT JOIN public.profiles p_other
    ON p_other.user_id = CASE
      WHEN b.user_id = auth.uid() THEN b.partner_user_id
      ELSE b.user_id
    END
  WHERE b.status = 'confirmada'
    AND b.ends_at >= now()
    AND (b.user_id = auth.uid() OR b.partner_user_id = auth.uid())
  ORDER BY b.starts_at ASC
  LIMIT GREATEST(_limit, 1);
$$;