-- ============================================
-- AcePlay S1: Foundation multi-tenant + auth
-- ============================================

-- ENUM de roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'club_admin', 'staff', 'member');

-- ENUM de estado de cuota
CREATE TYPE public.dues_status AS ENUM ('al_dia', 'pendiente', 'moroso', 'suspendido');

-- ============================================
-- 1. TENANTS (clubs)
-- ============================================
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  brand_primary TEXT NOT NULL DEFAULT '16 78% 48%',
  brand_primary_glow TEXT NOT NULL DEFAULT '22 92% 58%',
  brand_primary_deep TEXT NOT NULL DEFAULT '14 70% 32%',
  logo_url TEXT,
  domain TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Santiago',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. PROFILES (un perfil = un socio en un club)
-- ============================================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  rut TEXT,
  phone TEXT,
  birth_date DATE,
  ntrp_level NUMERIC(2,1),
  club_ranking INTEGER,
  avatar_url TEXT,
  member_since DATE NOT NULL DEFAULT CURRENT_DATE,
  dues_status public.dues_status NOT NULL DEFAULT 'al_dia',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX idx_profiles_user ON public.profiles(user_id);

-- ============================================
-- 3. USER_ROLES (separada para evitar escalación)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, role)
);

CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant ON public.user_roles(tenant_id);

-- ============================================
-- 4. MEMBER_INVITATIONS
-- ============================================
CREATE TABLE public.member_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  rut TEXT,
  phone TEXT,
  role public.app_role NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX idx_invitations_token ON public.member_invitations(token);
CREATE INDEX idx_invitations_tenant ON public.member_invitations(tenant_id);
CREATE INDEX idx_invitations_email ON public.member_invitations(email);

-- ============================================
-- 5. SECURITY DEFINER FUNCTIONS (anti-recursión RLS)
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id UUID, _tenant_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (tenant_id = _tenant_id OR role = 'super_admin')
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_club_admin_of(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('club_admin', 'super_admin')
      AND (tenant_id = _tenant_id OR role = 'super_admin')
  );
$$;

-- ============================================
-- 6. UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON public.member_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 7. AUTO-CREAR PROFILE EN SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.member_invitations%ROWTYPE;
  v_tenant_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_role public.app_role := 'member';
  v_token TEXT;
BEGIN
  v_token := NEW.raw_user_meta_data ->> 'invitation_token';

  IF v_token IS NOT NULL THEN
    SELECT * INTO v_invitation
    FROM public.member_invitations
    WHERE token = v_token
      AND accepted_at IS NULL
      AND expires_at > now()
    LIMIT 1;

    IF FOUND THEN
      v_tenant_id := v_invitation.tenant_id;
      v_first_name := v_invitation.first_name;
      v_last_name := v_invitation.last_name;
      v_role := v_invitation.role;

      UPDATE public.member_invitations
      SET accepted_at = now()
      WHERE id = v_invitation.id;

      INSERT INTO public.profiles (
        user_id, tenant_id, email, first_name, last_name, rut, phone
      ) VALUES (
        NEW.id, v_tenant_id, NEW.email,
        v_first_name, v_last_name,
        v_invitation.rut, v_invitation.phone
      );

      INSERT INTO public.user_roles (user_id, tenant_id, role)
      VALUES (NEW.id, v_tenant_id, v_role);

      RETURN NEW;
    END IF;
  END IF;

  -- Sin invitación: usar metadata o defaults; tenant_id de metadata o el primero (piloto Providencia)
  v_first_name := COALESCE(NEW.raw_user_meta_data ->> 'first_name', split_part(NEW.email, '@', 1));
  v_last_name := COALESCE(NEW.raw_user_meta_data ->> 'last_name', '');
  v_tenant_id := COALESCE(
    (NEW.raw_user_meta_data ->> 'tenant_id')::UUID,
    (SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1)
  );

  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, tenant_id, email, first_name, last_name)
    VALUES (NEW.id, v_tenant_id, NEW.email, v_first_name, v_last_name);

    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (NEW.id, v_tenant_id, 'member');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 8. RLS
-- ============================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;

-- TENANTS
CREATE POLICY "Tenants visibles para usuarios autenticados de su club o super_admin"
ON public.tenants FOR SELECT
TO authenticated
USING (
  id = public.user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Solo super_admin crea tenants"
ON public.tenants FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "club_admin del tenant o super_admin lo edita"
ON public.tenants FOR UPDATE
TO authenticated
USING (public.is_club_admin_of(auth.uid(), id));

-- PROFILES
CREATE POLICY "Socios ven perfiles del mismo club"
ON public.profiles FOR SELECT
TO authenticated
USING (
  tenant_id = public.user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Cada usuario edita solo su perfil"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND tenant_id = public.user_tenant_id(auth.uid()));

CREATE POLICY "club_admin edita perfiles de su club"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_club_admin_of(auth.uid(), tenant_id));

-- USER_ROLES (nadie puede modificarse a sí mismo)
CREATE POLICY "Usuarios ven sus propios roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_club_admin_of(auth.uid(), tenant_id)
);

CREATE POLICY "Solo club_admin asigna roles en su club"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  public.is_club_admin_of(auth.uid(), tenant_id)
  AND user_id <> auth.uid()
);

CREATE POLICY "Solo club_admin elimina roles en su club"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  public.is_club_admin_of(auth.uid(), tenant_id)
  AND user_id <> auth.uid()
);

-- MEMBER_INVITATIONS
CREATE POLICY "Lectura pública por token (para flujo de aceptación)"
ON public.member_invitations FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "club_admin crea invitaciones en su club"
ON public.member_invitations FOR INSERT
TO authenticated
WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

CREATE POLICY "club_admin actualiza invitaciones en su club"
ON public.member_invitations FOR UPDATE
TO authenticated
USING (public.is_club_admin_of(auth.uid(), tenant_id));

CREATE POLICY "club_admin elimina invitaciones en su club"
ON public.member_invitations FOR DELETE
TO authenticated
USING (public.is_club_admin_of(auth.uid(), tenant_id));

-- ============================================
-- 9. SEED: Club de Tenis Providencia (piloto)
-- ============================================
INSERT INTO public.tenants (slug, name, short_name, brand_primary, brand_primary_glow, brand_primary_deep)
VALUES ('providencia', 'Club de Tenis Providencia', 'Providencia', '16 78% 48%', '22 92% 58%', '14 70% 32%');