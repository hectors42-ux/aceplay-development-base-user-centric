
-- Fix search_path del trigger anterior
CREATE OR REPLACE FUNCTION public._tg_tournaments_immutable_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id de un torneo es inmutable';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by de un torneo es inmutable';
  END IF;
  RETURN NEW;
END;
$$;

-- Grant: solo club_admin del tenant o super_admin
CREATE OR REPLACE FUNCTION public.grant_organizer_role(_user_id uuid, _tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.is_club_admin_of(auth.uid(), _tenant_id)) THEN
    RAISE EXCEPTION 'Solo un administrador del club puede otorgar la capacidad de organizador';
  END IF;

  IF public.user_tenant_id(_user_id) IS DISTINCT FROM _tenant_id THEN
    RAISE EXCEPTION 'El usuario no pertenece a este club';
  END IF;

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (_user_id, _tenant_id, 'organizador'::public.app_role)
  ON CONFLICT (user_id, tenant_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_organizer_role(_user_id uuid, _tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.is_club_admin_of(auth.uid(), _tenant_id)) THEN
    RAISE EXCEPTION 'Solo un administrador del club puede revocar la capacidad de organizador';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _user_id
    AND tenant_id = _tenant_id
    AND role = 'organizador'::public.app_role;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_organizer_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_organizer_role(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_organizer_role(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_organizer_role(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.grant_organizer_role(uuid, uuid) IS
  'Otorga rol organizador a un usuario en un tenant. Solo club_admin del tenant o super_admin. Futuro: un webhook de pago (service_role) podrá invocar esta función para auto-asignar el rol tras un pago exitoso.';
COMMENT ON FUNCTION public.revoke_organizer_role(uuid, uuid) IS
  'Revoca rol organizador. Solo club_admin del tenant o super_admin.';
