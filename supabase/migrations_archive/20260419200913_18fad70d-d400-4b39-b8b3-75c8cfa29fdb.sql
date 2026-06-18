-- ============================================================================
-- S4: LADDER / RANKING INTERNO
-- ============================================================================

-- Enums
CREATE TYPE public.ladder_position_status AS ENUM ('activo', 'inactivo', 'congelado');

CREATE TYPE public.ladder_challenge_status AS ENUM (
  'propuesto',
  'aceptado',
  'rechazado',
  'programado',
  'jugado',
  'expirado',
  'cancelado'
);

CREATE TYPE public.ladder_history_reason AS ENUM (
  'ingreso',
  'retiro',
  'desafio_ganado',
  'desafio_perdido',
  'walkover',
  'inactividad',
  'ajuste_admin'
);

-- ============================================================================
-- TABLE: ladders
-- ============================================================================
CREATE TABLE public.ladders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discipline public.tournament_discipline NOT NULL DEFAULT 'tenis_singles',
  gender public.category_gender NOT NULL DEFAULT 'mixto',
  surface public.court_surface NOT NULL DEFAULT 'arcilla',
  is_active BOOLEAN NOT NULL DEFAULT true,
  season_starts_at TIMESTAMPTZ,
  season_ends_at TIMESTAMPTZ,
  -- Reglas configurables
  challenge_window_days INTEGER NOT NULL DEFAULT 7,
  response_window_hours INTEGER NOT NULL DEFAULT 48,
  max_position_jump INTEGER NOT NULL DEFAULT 3,
  cooldown_days INTEGER NOT NULL DEFAULT 3,
  loser_drops_position BOOLEAN NOT NULL DEFAULT false,
  inactivity_days INTEGER NOT NULL DEFAULT 30,
  inactivity_drop_positions INTEGER NOT NULL DEFAULT 1,
  result_validation_mode public.result_validation_mode NOT NULL DEFAULT 'jugadores_con_confirmacion',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ladders_challenge_window_positive CHECK (challenge_window_days > 0),
  CONSTRAINT ladders_response_window_positive CHECK (response_window_hours > 0),
  CONSTRAINT ladders_max_jump_positive CHECK (max_position_jump > 0),
  CONSTRAINT ladders_cooldown_non_negative CHECK (cooldown_days >= 0),
  CONSTRAINT ladders_inactivity_positive CHECK (inactivity_days > 0),
  CONSTRAINT ladders_inactivity_drop_positive CHECK (inactivity_drop_positions >= 0)
);

CREATE INDEX idx_ladders_tenant ON public.ladders(tenant_id);
CREATE INDEX idx_ladders_active ON public.ladders(tenant_id, is_active);

ALTER TABLE public.ladders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven pirámides de su club"
  ON public.ladders FOR SELECT
  TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona pirámides de su club"
  ON public.ladders FOR ALL
  TO authenticated
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

-- ============================================================================
-- TABLE: ladder_positions
-- ============================================================================
CREATE TABLE public.ladder_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ladder_id UUID NOT NULL REFERENCES public.ladders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  position INTEGER NOT NULL,
  status public.ladder_position_status NOT NULL DEFAULT 'activo',
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  walkovers_for INTEGER NOT NULL DEFAULT 0,
  walkovers_against INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_played_at TIMESTAMPTZ,
  last_challenged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ladder_positions_position_positive CHECK (position > 0),
  CONSTRAINT ladder_positions_unique_user UNIQUE (ladder_id, user_id),
  CONSTRAINT ladder_positions_unique_position UNIQUE (ladder_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_ladder_positions_ladder ON public.ladder_positions(ladder_id, position);
CREATE INDEX idx_ladder_positions_tenant ON public.ladder_positions(tenant_id);
CREATE INDEX idx_ladder_positions_user ON public.ladder_positions(user_id);

ALTER TABLE public.ladder_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven posiciones de su club"
  ON public.ladder_positions FOR SELECT
  TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona posiciones de su club"
  ON public.ladder_positions FOR ALL
  TO authenticated
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

-- ============================================================================
-- TABLE: ladder_challenges
-- ============================================================================
CREATE TABLE public.ladder_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ladder_id UUID NOT NULL REFERENCES public.ladders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  challenger_user_id UUID NOT NULL,
  challenged_user_id UUID NOT NULL,
  challenger_position INTEGER NOT NULL,
  challenged_position INTEGER NOT NULL,
  status public.ladder_challenge_status NOT NULL DEFAULT 'propuesto',
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  scheduled_at TIMESTAMPTZ,
  court_id UUID REFERENCES public.courts(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  played_at TIMESTAMPTZ,
  winner_user_id UUID,
  loser_user_id UUID,
  score JSONB,
  retired BOOLEAN NOT NULL DEFAULT false,
  walkover BOOLEAN NOT NULL DEFAULT false,
  reject_reason TEXT,
  cancel_reason TEXT,
  result_proposed_by UUID,
  result_proposed_at TIMESTAMPTZ,
  result_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ladder_challenges_different_players CHECK (challenger_user_id <> challenged_user_id),
  CONSTRAINT ladder_challenges_positions_positive CHECK (challenger_position > 0 AND challenged_position > 0)
);

CREATE INDEX idx_ladder_challenges_ladder ON public.ladder_challenges(ladder_id, status);
CREATE INDEX idx_ladder_challenges_tenant ON public.ladder_challenges(tenant_id);
CREATE INDEX idx_ladder_challenges_challenger ON public.ladder_challenges(challenger_user_id, status);
CREATE INDEX idx_ladder_challenges_challenged ON public.ladder_challenges(challenged_user_id, status);
CREATE INDEX idx_ladder_challenges_pair ON public.ladder_challenges(ladder_id, challenger_user_id, challenged_user_id, played_at);
CREATE INDEX idx_ladder_challenges_expires ON public.ladder_challenges(expires_at) WHERE status IN ('propuesto', 'aceptado');

ALTER TABLE public.ladder_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven desafíos de su club"
  ON public.ladder_challenges FOR SELECT
  TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona desafíos de su club"
  ON public.ladder_challenges FOR ALL
  TO authenticated
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

-- ============================================================================
-- TABLE: ladder_history
-- ============================================================================
CREATE TABLE public.ladder_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ladder_id UUID NOT NULL REFERENCES public.ladders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  position_before INTEGER,
  position_after INTEGER,
  reason public.ladder_history_reason NOT NULL,
  challenge_id UUID REFERENCES public.ladder_challenges(id) ON DELETE SET NULL,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID
);

CREATE INDEX idx_ladder_history_ladder ON public.ladder_history(ladder_id, recorded_at DESC);
CREATE INDEX idx_ladder_history_tenant ON public.ladder_history(tenant_id);
CREATE INDEX idx_ladder_history_user ON public.ladder_history(user_id, recorded_at DESC);
CREATE INDEX idx_ladder_history_challenge ON public.ladder_history(challenge_id);

ALTER TABLE public.ladder_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven historial de pirámides de su club"
  ON public.ladder_history FOR SELECT
  TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona historial de pirámides"
  ON public.ladder_history FOR ALL
  TO authenticated
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

-- ============================================================================
-- TRIGGERS: updated_at automático
-- ============================================================================
CREATE TRIGGER trg_ladders_updated_at
  BEFORE UPDATE ON public.ladders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_ladder_positions_updated_at
  BEFORE UPDATE ON public.ladder_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_ladder_challenges_updated_at
  BEFORE UPDATE ON public.ladder_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- HELPER: is_ladder_challenge_party
-- Valida si un usuario es retador o desafiado en un desafío específico.
-- Usado por futuras RPCs de respuesta, programación y resultado.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_ladder_challenge_party(_challenge_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ladder_challenges
    WHERE id = _challenge_id
      AND (challenger_user_id = _user_id OR challenged_user_id = _user_id)
  );
$$;
