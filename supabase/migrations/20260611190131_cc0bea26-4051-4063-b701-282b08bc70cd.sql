
-- Trigger: bloquear cambios de tenant_id o created_by en tournaments
CREATE OR REPLACE FUNCTION public._tg_tournaments_immutable_owner()
RETURNS trigger
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS tournaments_immutable_owner ON public.tournaments;
CREATE TRIGGER tournaments_immutable_owner
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public._tg_tournaments_immutable_owner();

-- tournaments: reemplazar policy FOR ALL por INSERT/UPDATE/DELETE granulares
DROP POLICY IF EXISTS "club_admin gestiona torneos de su club" ON public.tournaments;

CREATE POLICY "Crear torneos (admin u organizador del club)"
  ON public.tournaments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_create_tournament(tenant_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Gestionar torneos propios"
  ON public.tournaments
  FOR UPDATE
  TO authenticated
  USING (public.is_tournament_manager(id))
  WITH CHECK (public.is_tournament_manager(id));

CREATE POLICY "Eliminar torneos propios"
  ON public.tournaments
  FOR DELETE
  TO authenticated
  USING (public.is_tournament_manager(id));

-- tournament_categories
DROP POLICY IF EXISTS "club_admin gestiona categorías" ON public.tournament_categories;
CREATE POLICY "Manager del torneo gestiona categorías"
  ON public.tournament_categories
  FOR ALL
  TO authenticated
  USING (public.is_tournament_manager(tournament_id))
  WITH CHECK (public.is_tournament_manager(tournament_id));

-- tournament_registrations
DROP POLICY IF EXISTS "club_admin gestiona inscripciones de su club" ON public.tournament_registrations;
CREATE POLICY "Manager del torneo gestiona inscripciones"
  ON public.tournament_registrations
  FOR ALL
  TO authenticated
  USING (public.is_tournament_manager(tournament_id))
  WITH CHECK (public.is_tournament_manager(tournament_id));

-- tournament_matches
DROP POLICY IF EXISTS "club_admin gestiona partidos de su club" ON public.tournament_matches;
CREATE POLICY "Manager del torneo gestiona partidos"
  ON public.tournament_matches
  FOR ALL
  TO authenticated
  USING (public.is_tournament_manager(tournament_id))
  WITH CHECK (public.is_tournament_manager(tournament_id));

-- tournament_phases
DROP POLICY IF EXISTS "club_admin gestiona fases" ON public.tournament_phases;
CREATE POLICY "Manager del torneo gestiona fases"
  ON public.tournament_phases
  FOR ALL
  TO authenticated
  USING (public.is_tournament_manager(tournament_id))
  WITH CHECK (public.is_tournament_manager(tournament_id));
