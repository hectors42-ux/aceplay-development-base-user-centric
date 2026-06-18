-- 1. Reemplazar la política club-wide de SELECT en profiles
DROP POLICY IF EXISTS "Socios ven perfiles del mismo club" ON public.profiles;

CREATE POLICY "Dueño o admin ven perfil completo"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_club_admin_of(auth.uid(), tenant_id)
  OR is_super_admin(auth.uid())
);

-- 2. Crear vista de directorio para que los socios sigan viendo a sus compañeros
-- Las vistas en Postgres bypassan RLS de la tabla base (security_definer por defecto),
-- por eso el filtrado por tenant se hace dentro de la vista.
CREATE OR REPLACE VIEW public.profiles_directory
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.user_id,
  p.tenant_id,
  p.first_name,
  p.last_name,
  p.avatar_url,
  p.ntrp_level,
  p.club_ranking,
  p.member_since,
  p.bio,
  p.dominant_hand,
  p.backhand,
  p.favorite_shot,
  p.favorite_surface,
  p.playing_style,
  p.availability,
  p.years_playing,
  p.show_email,
  p.show_phone,
  CASE
    WHEN p.user_id = auth.uid() THEN p.email
    WHEN is_club_admin_of(auth.uid(), p.tenant_id) THEN p.email
    WHEN is_super_admin(auth.uid()) THEN p.email
    WHEN COALESCE(p.show_email, false) THEN p.email
    ELSE NULL
  END AS email,
  CASE
    WHEN p.user_id = auth.uid() THEN p.phone
    WHEN is_club_admin_of(auth.uid(), p.tenant_id) THEN p.phone
    WHEN is_super_admin(auth.uid()) THEN p.phone
    WHEN COALESCE(p.show_phone, false) THEN p.phone
    ELSE NULL
  END AS phone,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE
  p.tenant_id = user_tenant_id(auth.uid())
  OR is_super_admin(auth.uid());

GRANT SELECT ON public.profiles_directory TO authenticated;