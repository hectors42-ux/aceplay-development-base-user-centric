REVOKE ALL ON FUNCTION public.create_booking(uuid, timestamptz, uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking(uuid, timestamptz, uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, timestamptz, uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.reschedule_partner_match(uuid, uuid, timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reschedule_partner_match(uuid, uuid, timestamptz, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.reschedule_partner_match(uuid, uuid, timestamptz, integer) TO authenticated;