
-- PRD 11 · Push templates: preferencias, helper enqueue con anti-spam, triggers nuevos

-- 1) Preferencias por usuario
CREATE TABLE IF NOT EXISTS public.user_push_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  juego boolean NOT NULL DEFAULT true,
  marketing boolean NOT NULL DEFAULT true,
  sistema boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_push_preferences TO authenticated;
GRANT ALL ON public.user_push_preferences TO service_role;

ALTER TABLE public.user_push_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario ve sus preferencias" ON public.user_push_preferences;
CREATE POLICY "Usuario ve sus preferencias" ON public.user_push_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuario upsertea sus preferencias" ON public.user_push_preferences;
CREATE POLICY "Usuario upsertea sus preferencias" ON public.user_push_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuario actualiza sus preferencias" ON public.user_push_preferences;
CREATE POLICY "Usuario actualiza sus preferencias" ON public.user_push_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_user_push_preferences()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_user_push_preferences ON public.user_push_preferences;
CREATE TRIGGER trg_touch_user_push_preferences
  BEFORE UPDATE ON public.user_push_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_push_preferences();

-- 2) Helper unificado: respeta preferencias + cap anti-spam (3/24h por torneo)
CREATE OR REPLACE FUNCTION public.enqueue_user_notification(
  _user_id uuid,
  _tenant_id uuid,
  _kind text,
  _category text,        -- 'juego' | 'marketing' | 'sistema'
  _title text,
  _body text,
  _link text,
  _ref_id uuid,
  _tournament_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pref record;
  v_allowed boolean := true;
  v_count int;
  v_id uuid;
BEGIN
  IF _user_id IS NULL OR _kind IS NULL THEN
    RETURN NULL;
  END IF;

  -- Preferencias (defaults ON si la fila no existe)
  SELECT juego, marketing, sistema INTO v_pref
  FROM public.user_push_preferences WHERE user_id = _user_id;

  IF v_pref IS NOT NULL THEN
    IF _category = 'marketing' AND NOT v_pref.marketing THEN v_allowed := false;
    ELSIF _category = 'sistema' AND NOT v_pref.sistema THEN v_allowed := false;
    ELSIF _category = 'juego' AND NOT v_pref.juego THEN v_allowed := false;
    END IF;
  END IF;

  IF NOT v_allowed THEN RETURN NULL; END IF;

  -- Cap anti-spam: máx 3 notificaciones de torneo por usuario por torneo en 24h
  IF _tournament_id IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.user_notifications
    WHERE user_id = _user_id
      AND created_at > now() - interval '24 hours'
      AND (
        kind LIKE 'tournament_%'
        OR kind IN ('partner_changed','operator_assigned','round_started',
                    'your_match_in_10','result_pending_confirmation',
                    'match_disputed','result_auto_confirmed','you_won_match',
                    'climbed_positions','session_ended_share_day','streak_started')
      );
    IF v_count >= 3 THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, description, link, ref_id)
  VALUES (_tenant_id, _user_id, _kind, _title, _body, _link, _ref_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_user_notification(uuid,uuid,text,text,text,text,text,uuid,uuid) TO authenticated, service_role;

-- 3) Trigger: tournament_drawing_published
CREATE OR REPLACE FUNCTION public.notify_tournament_drawing_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament record;
  v_link text;
  v_reg record;
BEGIN
  IF NEW.bracket_generated_at IS NULL THEN RETURN NEW; END IF;
  IF OLD.bracket_generated_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT id, slug, tenant_id, name INTO v_tournament
  FROM public.tournaments WHERE id = NEW.tournament_id;
  IF v_tournament.id IS NULL THEN RETURN NEW; END IF;

  v_link := '/torneos/' || COALESCE(v_tournament.slug, v_tournament.id::text)
            || '/cat/' || NEW.id::text;

  FOR v_reg IN
    SELECT DISTINCT uid FROM (
      SELECT player1_user_id AS uid FROM public.tournament_registrations
        WHERE category_id = NEW.id AND status = 'confirmada' AND player1_user_id IS NOT NULL
      UNION
      SELECT player2_user_id FROM public.tournament_registrations
        WHERE category_id = NEW.id AND status = 'confirmada' AND player2_user_id IS NOT NULL
    ) u
  LOOP
    PERFORM public.enqueue_user_notification(
      v_reg.uid,
      v_tournament.tenant_id,
      'tournament_drawing_published',
      'juego',
      'El sorteo está',
      'Mirá con quién jugás. → Ver',
      v_link,
      NEW.id,
      v_tournament.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tournament_drawing_published ON public.tournament_categories;
CREATE TRIGGER trg_notify_tournament_drawing_published
  AFTER UPDATE OF bracket_generated_at ON public.tournament_categories
  FOR EACH ROW EXECUTE FUNCTION public.notify_tournament_drawing_published();

-- 4) Trigger: operator_assigned
CREATE OR REPLACE FUNCTION public.notify_operator_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament record;
BEGIN
  SELECT id, slug, tenant_id, name INTO v_tournament
  FROM public.tournaments WHERE id = NEW.tournament_id;
  IF v_tournament.id IS NULL THEN RETURN NEW; END IF;

  PERFORM public.enqueue_user_notification(
    NEW.user_id,
    v_tournament.tenant_id,
    'operator_assigned',
    'sistema',
    'Sos operador',
    'Del torneo ' || COALESCE(v_tournament.name, '') || '. → Entrar',
    '/torneos/' || COALESCE(v_tournament.slug, v_tournament.id::text) || '/operar',
    v_tournament.id,
    v_tournament.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_operator_assigned ON public.tournament_operators;
CREATE TRIGGER trg_notify_operator_assigned
  AFTER INSERT ON public.tournament_operators
  FOR EACH ROW EXECUTE FUNCTION public.notify_operator_assigned();

-- 5) Trigger: tournament_ended (status -> 'finalizado')
CREATE OR REPLACE FUNCTION public.notify_tournament_ended()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link text;
  v_uid uuid;
BEGIN
  IF NEW.status <> 'finalizado' OR OLD.status = 'finalizado' THEN
    RETURN NEW;
  END IF;

  v_link := '/torneos/' || COALESCE(NEW.slug, NEW.id::text);

  FOR v_uid IN
    SELECT DISTINCT uid FROM (
      SELECT player1_user_id AS uid FROM public.tournament_registrations
        WHERE tournament_id = NEW.id AND status = 'confirmada' AND player1_user_id IS NOT NULL
      UNION
      SELECT player2_user_id FROM public.tournament_registrations
        WHERE tournament_id = NEW.id AND status = 'confirmada' AND player2_user_id IS NOT NULL
    ) u
  LOOP
    PERFORM public.enqueue_user_notification(
      v_uid,
      NEW.tenant_id,
      'tournament_ended',
      'juego',
      'El torneo cerró',
      'Mirá la tabla final.',
      v_link,
      NEW.id,
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tournament_ended ON public.tournaments;
CREATE TRIGGER trg_notify_tournament_ended
  AFTER UPDATE OF status ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.notify_tournament_ended();
