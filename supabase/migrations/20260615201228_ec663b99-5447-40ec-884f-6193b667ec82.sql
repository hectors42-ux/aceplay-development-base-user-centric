
CREATE TABLE public.tournament_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  court_ids     uuid[] NOT NULL DEFAULT '{}',
  block_label   text NOT NULL DEFAULT 'Torneo',
  status        text NOT NULL DEFAULT 'planificada'
                CHECK (status IN ('planificada','bloqueada','en_curso','finalizada')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_tournament_sessions_tournament ON public.tournament_sessions(tournament_id);
CREATE INDEX idx_tournament_sessions_starts_at  ON public.tournament_sessions(starts_at);
CREATE INDEX idx_tournament_sessions_tenant     ON public.tournament_sessions(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_sessions TO authenticated;
GRANT ALL ON public.tournament_sessions TO service_role;

ALTER TABLE public.tournament_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can view sessions"
ON public.tournament_sessions FOR SELECT TO authenticated
USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant admins manage sessions"
ON public.tournament_sessions FOR ALL TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  AND (public.has_role(auth.uid(), 'club_admin') OR public.has_role(auth.uid(), 'super_admin'))
)
WITH CHECK (
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  AND (public.has_role(auth.uid(), 'club_admin') OR public.has_role(auth.uid(), 'super_admin'))
);

CREATE TRIGGER trg_tournament_sessions_updated_at
BEFORE UPDATE ON public.tournament_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tournament_registrations
  ADD COLUMN IF NOT EXISTS session_availability uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS block_reason text;

CREATE INDEX IF NOT EXISTS idx_bookings_block_reason
  ON public.bookings(block_reason)
  WHERE block_reason IS NOT NULL;

CREATE TABLE public.tournament_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor         uuid REFERENCES auth.users(id),
  at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tournament_events_tournament ON public.tournament_events(tournament_id, at DESC);
CREATE INDEX idx_tournament_events_kind ON public.tournament_events(kind);

GRANT SELECT, INSERT ON public.tournament_events TO authenticated;
GRANT ALL ON public.tournament_events TO service_role;

ALTER TABLE public.tournament_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can view events"
ON public.tournament_events FOR SELECT TO authenticated
USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant members can insert events"
ON public.tournament_events FOR INSERT TO authenticated
WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION public.block_tournament_session(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.tournament_sessions%ROWTYPE;
  _court uuid;
BEGIN
  SELECT * INTO s FROM public.tournament_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no encontrada'; END IF;

  IF NOT (public.has_role(auth.uid(), 'club_admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Solo administradores pueden bloquear canchas';
  END IF;

  DELETE FROM public.bookings WHERE block_reason = _session_id::text;

  FOREACH _court IN ARRAY s.court_ids LOOP
    INSERT INTO public.bookings (tenant_id, court_id, user_id, starts_at, ends_at, status, block_reason, notes)
    VALUES (s.tenant_id, _court, auth.uid(), s.starts_at, s.ends_at, 'confirmed', _session_id::text, s.block_label);
  END LOOP;

  UPDATE public.tournament_sessions SET status = 'bloqueada', updated_at = now() WHERE id = _session_id;

  INSERT INTO public.tournament_events (tournament_id, tenant_id, kind, payload, actor)
  VALUES (s.tournament_id, s.tenant_id, 'session_blocked',
          jsonb_build_object('session_id', _session_id, 'court_count', array_length(s.court_ids,1)),
          auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_tournament_session(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.tournament_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.tournament_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no encontrada'; END IF;

  IF NOT (public.has_role(auth.uid(), 'club_admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Solo administradores pueden desbloquear canchas';
  END IF;

  DELETE FROM public.bookings WHERE block_reason = _session_id::text;

  UPDATE public.tournament_sessions SET status = 'planificada', updated_at = now() WHERE id = _session_id;

  INSERT INTO public.tournament_events (tournament_id, tenant_id, kind, payload, actor)
  VALUES (s.tournament_id, s.tenant_id, 'session_unblocked',
          jsonb_build_object('session_id', _session_id), auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_session_bookings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.bookings WHERE block_reason = OLD.id::text;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_cleanup_session_bookings
BEFORE DELETE ON public.tournament_sessions
FOR EACH ROW EXECUTE FUNCTION public.cleanup_session_bookings();
