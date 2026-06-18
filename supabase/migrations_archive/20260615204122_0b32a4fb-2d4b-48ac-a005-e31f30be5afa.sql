
-- PRD 3 · Fase A: tournament_operators

CREATE TABLE public.tournament_operators (
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.tournament_operators TO authenticated;
GRANT ALL ON public.tournament_operators TO service_role;

ALTER TABLE public.tournament_operators ENABLE ROW LEVEL SECURITY;

-- Helper: tenant_id of a tournament (security definer to bypass RLS recursion)
CREATE OR REPLACE FUNCTION public.tournament_tenant_id(_tournament_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tournaments WHERE id = _tournament_id
$$;

-- Helper: is the user a club_admin or super_admin for the tournament's tenant?
CREATE OR REPLACE FUNCTION public.is_tournament_admin(_tournament_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = _user_id
          AND ur.role = 'club_admin'::app_role
          AND ur.tenant_id = public.tournament_tenant_id(_tournament_id)
      );
$$;

-- Helper: is the user an operator for the tournament?
CREATE OR REPLACE FUNCTION public.is_tournament_operator(_tournament_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_operators
    WHERE tournament_id = _tournament_id AND user_id = _user_id
  );
$$;

-- RLS policies
CREATE POLICY "Admin del torneo ve operadores"
  ON public.tournament_operators FOR SELECT
  TO authenticated
  USING (
    public.is_tournament_admin(tournament_id, auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Admin del torneo agrega operadores"
  ON public.tournament_operators FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tournament_admin(tournament_id, auth.uid())
    AND granted_by = auth.uid()
  );

CREATE POLICY "Admin del torneo quita operadores"
  ON public.tournament_operators FOR DELETE
  TO authenticated
  USING (public.is_tournament_admin(tournament_id, auth.uid()));

-- Extend tournament_matches policy: operadores también pueden editar matches de su torneo
CREATE POLICY "Operador del torneo gestiona partidos"
  ON public.tournament_matches FOR UPDATE
  TO authenticated
  USING (public.is_tournament_operator(tournament_id, auth.uid()))
  WITH CHECK (public.is_tournament_operator(tournament_id, auth.uid()));

-- Operador también puede mover el estado de sesiones del torneo
CREATE POLICY "Operador del torneo actualiza sesiones"
  ON public.tournament_sessions FOR UPDATE
  TO authenticated
  USING (public.is_tournament_operator(tournament_id, auth.uid()))
  WITH CHECK (public.is_tournament_operator(tournament_id, auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_operators;
