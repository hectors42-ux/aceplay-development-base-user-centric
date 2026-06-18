-- ============================================================
-- 2) BOOKINGS: column-level grants para ocultar campos sensibles
-- ============================================================

-- Revocar SELECT amplio
REVOKE SELECT ON public.bookings FROM authenticated;
REVOKE SELECT ON public.bookings FROM anon;

-- Conceder SELECT solo en columnas no sensibles a authenticated
GRANT SELECT (id, tenant_id, court_id, user_id, starts_at, ends_at, status, created_at, period, kind)
  ON public.bookings TO authenticated;

-- Mantener acceso completo a service_role (edge functions / admin)
GRANT ALL ON public.bookings TO service_role;

-- Función SECURITY DEFINER para que dueño/compañero/admin acceda a campos sensibles
CREATE OR REPLACE FUNCTION public.get_booking_sensitive(_booking_id uuid)
RETURNS TABLE (
  id uuid,
  partner_user_id uuid,
  notes text,
  cancelled_at timestamptz,
  cancelled_by uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.partner_user_id, b.notes, b.cancelled_at, b.cancelled_by
  FROM public.bookings b
  WHERE b.id = _booking_id
    AND (
      b.user_id = auth.uid()
      OR b.partner_user_id = auth.uid()
      OR public.is_club_admin_of(auth.uid(), b.tenant_id)
      OR public.is_super_admin(auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.get_booking_sensitive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booking_sensitive(uuid) TO authenticated;

-- ============================================================
-- 3) REALTIME: agregar RLS básico a realtime.messages
-- ============================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can read realtime messages"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can broadcast realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can broadcast realtime messages"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 4) EXTENSIONES: mover btree_gist fuera del esquema public
-- ============================================================
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;
ALTER EXTENSION btree_gist SET SCHEMA extensions;

-- ============================================================
-- 5) STORAGE: evitar listing en bucket público de avatars
-- ============================================================
DROP POLICY IF EXISTS "Avatars legibles para autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Avatars públicos lectura" ON storage.objects;
-- Los avatares siguen siendo accesibles vía URL pública del CDN (bucket public=true),
-- pero ya no se puede enumerar el contenido del bucket desde el cliente.

-- Limpiar policies INSERT/UPDATE/DELETE duplicadas
DROP POLICY IF EXISTS "Usuario actualiza su avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuario borra su avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuario sube su avatar" ON storage.objects;