-- 1) Revoke public EXECUTE on dev/test reset function
REVOKE ALL ON FUNCTION public._e2e_reset_padel_ladder() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._e2e_reset_padel_ladder() FROM anon;
REVOKE ALL ON FUNCTION public._e2e_reset_padel_ladder() FROM authenticated;
GRANT EXECUTE ON FUNCTION public._e2e_reset_padel_ladder() TO service_role;

-- 2) Add explicit SELECT policy on member_invitations for club admins
DROP POLICY IF EXISTS "member_invitations_admin_read" ON public.member_invitations;
CREATE POLICY "member_invitations_admin_read"
  ON public.member_invitations
  FOR SELECT
  TO authenticated
  USING (
    public.is_club_admin_of(auth.uid(), tenant_id)
    OR public.is_super_admin(auth.uid())
  );

-- 3) Switch profiles_directory view to security_invoker so RLS of caller applies
ALTER VIEW public.profiles_directory SET (security_invoker = true);