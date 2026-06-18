
-- 1) Bookings: revoke direct read on sensitive columns
REVOKE SELECT (notes, cancelled_by) ON public.bookings FROM authenticated;
REVOKE SELECT (notes, cancelled_by) ON public.bookings FROM anon;

-- 2) coach_class_bookings: revoke direct read on external student PII
REVOKE SELECT (external_student_name, external_student_phone) ON public.coach_class_bookings FROM authenticated;
REVOKE SELECT (external_student_name, external_student_phone) ON public.coach_class_bookings FROM anon;

-- RPC for coach/admin to read external student PII
CREATE OR REPLACE FUNCTION public.get_coach_class_external_contact(_booking_id uuid)
RETURNS TABLE(external_student_name text, external_student_phone text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_coach_user uuid;
BEGIN
  SELECT b.tenant_id, cp.user_id INTO v_tenant, v_coach_user
  FROM public.coach_class_bookings b
  JOIN public.coach_profiles cp ON cp.id = b.coach_id
  WHERE b.id = _booking_id;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF auth.uid() = v_coach_user
     OR public.is_club_admin_of(auth.uid(), v_tenant)
     OR public.is_super_admin(auth.uid()) THEN
    RETURN QUERY
      SELECT b.external_student_name, b.external_student_phone
      FROM public.coach_class_bookings b
      WHERE b.id = _booking_id;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_coach_class_external_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coach_class_external_contact(uuid) TO authenticated;

-- 3) Tournament tables: restrict policies to authenticated only (remove anon attack surface)
ALTER POLICY "Socios ven categorías de su club" ON public.tournament_categories TO authenticated;
ALTER POLICY "club_admin gestiona categorías" ON public.tournament_categories TO authenticated;

ALTER POLICY "Socios ven solicitudes de reagendar de su club" ON public.tournament_match_reschedule_requests TO authenticated;
ALTER POLICY "club_admin gestiona solicitudes de reagendar" ON public.tournament_match_reschedule_requests TO authenticated;

ALTER POLICY "Socios ven propuestas de resultado de su club" ON public.tournament_match_results TO authenticated;
ALTER POLICY "club_admin gestiona propuestas de resultado" ON public.tournament_match_results TO authenticated;

-- 4) Avatars bucket: restrict listing to owner only (public URLs continue to work for reads)
CREATE POLICY "Usuario lista su propio avatar"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
