-- 1) member_invitations: quitar SELECT público por token
DROP POLICY IF EXISTS "Lectura pública por token (para flujo de aceptación)" ON public.member_invitations;

-- Función SECURITY DEFINER que devuelve sólo lo necesario para el flujo de aceptación
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  tenant_id uuid,
  accepted_at timestamptz,
  expires_at timestamptz,
  tenant_name text,
  tenant_short_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mi.id, mi.email, mi.first_name, mi.last_name, mi.tenant_id,
         mi.accepted_at, mi.expires_at,
         t.name AS tenant_name, t.short_name AS tenant_short_name
  FROM public.member_invitations mi
  LEFT JOIN public.tenants t ON t.id = mi.tenant_id
  WHERE mi.token = _token
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

-- 2) player_ratings: quitar UPDATE de usuario (las RPC SECURITY DEFINER seguirán funcionando)
DROP POLICY IF EXISTS "Usuario actualiza su propio rating" ON public.player_ratings;
DROP POLICY IF EXISTS "Usuario crea su propio rating" ON public.player_ratings;