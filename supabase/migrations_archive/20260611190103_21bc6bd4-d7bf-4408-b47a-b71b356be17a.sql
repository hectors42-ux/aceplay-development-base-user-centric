
CREATE OR REPLACE FUNCTION public.is_tournament_manager(_tournament_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = _tournament_id
      AND (
        public.is_super_admin(auth.uid())
        OR public.is_club_admin_of(auth.uid(), t.tenant_id)
        OR (
          t.created_by = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.tenant_id = t.tenant_id
              AND ur.role = 'organizador'::public.app_role
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_create_tournament(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR public.is_club_admin_of(auth.uid(), _tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = _tenant_id
        AND ur.role = 'organizador'::public.app_role
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_tournament_manager(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_create_tournament(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tournament_manager(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_create_tournament(uuid) TO authenticated, service_role;
