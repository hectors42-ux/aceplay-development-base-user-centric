
-- ENUMS
CREATE TYPE public.partner_invitation_status AS ENUM ('pending','accepted','rejected','expired','cancelled');
CREATE TYPE public.partner_match_format AS ENUM ('1set','best_of_3','best_of_5');
CREATE TYPE public.partner_post_status AS ENUM ('open','matched','expired','cancelled');

-- TABLES
CREATE TABLE public.user_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, weekday, starts_at)
);
CREATE INDEX idx_user_availability_user ON public.user_availability(user_id);
CREATE INDEX idx_user_availability_tenant ON public.user_availability(tenant_id);

CREATE TABLE public.match_search_filters (
  user_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  level_delta numeric NOT NULL DEFAULT 0.5,
  category text,
  preferred_days smallint[] DEFAULT '{}',
  time_window jsonb DEFAULT '{"start":"08:00","end":"22:00"}'::jsonb,
  surface court_surface,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.match_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  inviter_user_id uuid NOT NULL,
  invitee_user_id uuid NOT NULL,
  status partner_invitation_status NOT NULL DEFAULT 'pending',
  proposed_slots jsonb NOT NULL,
  selected_slot jsonb,
  message text,
  compat_score int,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_match_invitations_invitee ON public.match_invitations(invitee_user_id, status);
CREATE INDEX idx_match_invitations_inviter ON public.match_invitations(inviter_user_id, status);
CREATE INDEX idx_match_invitations_tenant ON public.match_invitations(tenant_id);

CREATE TABLE public.match_open_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  format partner_match_format NOT NULL DEFAULT 'best_of_3',
  available_slots jsonb NOT NULL,
  note text,
  status partner_post_status NOT NULL DEFAULT 'open',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_match_open_posts_tenant_status ON public.match_open_posts(tenant_id, status);

CREATE TABLE public.match_post_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.match_open_posts(id) ON DELETE CASCADE,
  responder_user_id uuid NOT NULL,
  selected_slot jsonb NOT NULL,
  status partner_invitation_status NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_match_post_responses_post ON public.match_post_responses(post_id);

-- TRIGGERS updated_at
CREATE TRIGGER trg_user_availability_updated BEFORE UPDATE ON public.user_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_match_search_filters_updated BEFORE UPDATE ON public.match_search_filters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_match_invitations_updated BEFORE UPDATE ON public.match_invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_match_open_posts_updated BEFORE UPDATE ON public.match_open_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_match_post_responses_updated BEFORE UPDATE ON public.match_post_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.user_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_search_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_open_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_post_responses ENABLE ROW LEVEL SECURITY;

-- user_availability: dueño gestiona, socios del club leen
CREATE POLICY "user_availability_owner_all" ON public.user_availability
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND tenant_id = user_tenant_id(auth.uid()));
CREATE POLICY "user_availability_club_read" ON public.user_availability
  FOR SELECT TO authenticated
  USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- match_search_filters: solo dueño
CREATE POLICY "msf_owner_all" ON public.match_search_filters
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND tenant_id = user_tenant_id(auth.uid()));

-- match_invitations: solo involucrados o admin
CREATE POLICY "mi_parties_read" ON public.match_invitations
  FOR SELECT TO authenticated
  USING (inviter_user_id = auth.uid() OR invitee_user_id = auth.uid() OR is_club_admin_of(auth.uid(), tenant_id));
CREATE POLICY "mi_inviter_insert" ON public.match_invitations
  FOR INSERT TO authenticated
  WITH CHECK (inviter_user_id = auth.uid() AND tenant_id = user_tenant_id(auth.uid()));
CREATE POLICY "mi_parties_update" ON public.match_invitations
  FOR UPDATE TO authenticated
  USING (inviter_user_id = auth.uid() OR invitee_user_id = auth.uid())
  WITH CHECK (inviter_user_id = auth.uid() OR invitee_user_id = auth.uid());

-- match_open_posts: socios del club leen, dueño gestiona
CREATE POLICY "mop_club_read" ON public.match_open_posts
  FOR SELECT TO authenticated
  USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "mop_owner_write" ON public.match_open_posts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND tenant_id = user_tenant_id(auth.uid()));

-- match_post_responses: dueño del post + responder + admin
CREATE POLICY "mpr_parties_read" ON public.match_post_responses
  FOR SELECT TO authenticated
  USING (
    responder_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.match_open_posts p WHERE p.id = post_id AND p.user_id = auth.uid())
    OR is_club_admin_of(auth.uid(), tenant_id)
  );
CREATE POLICY "mpr_responder_insert" ON public.match_post_responses
  FOR INSERT TO authenticated
  WITH CHECK (responder_user_id = auth.uid() AND tenant_id = user_tenant_id(auth.uid()));
CREATE POLICY "mpr_parties_update" ON public.match_post_responses
  FOR UPDATE TO authenticated
  USING (
    responder_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.match_open_posts p WHERE p.id = post_id AND p.user_id = auth.uid())
  );

-- =========================================================
-- RPC: get_recent_partners
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_recent_partners(_limit int DEFAULT 8)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  last_played_at timestamptz,
  source text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid := user_tenant_id(v_uid);
BEGIN
  RETURN QUERY
  WITH partners AS (
    -- Pirámide jugada
    SELECT
      CASE WHEN c.challenger_user_id = v_uid THEN c.challenged_user_id ELSE c.challenger_user_id END AS partner_id,
      COALESCE(c.played_at, c.updated_at) AS played_at,
      'ladder'::text AS src
    FROM public.ladder_challenges c
    WHERE c.tenant_id = v_tenant
      AND c.status::text IN ('jugado','confirmado','aceptado')
      AND (c.challenger_user_id = v_uid OR c.challenged_user_id = v_uid)
      AND COALESCE(c.played_at, c.updated_at) IS NOT NULL

    UNION ALL
    -- Reservas con partner
    SELECT
      CASE WHEN b.user_id = v_uid THEN b.partner_user_id ELSE b.user_id END,
      b.starts_at,
      'booking'::text
    FROM public.bookings b
    WHERE b.tenant_id = v_tenant
      AND b.status::text = 'confirmada'
      AND b.starts_at < now()
      AND b.partner_user_id IS NOT NULL
      AND (b.user_id = v_uid OR b.partner_user_id = v_uid)

    UNION ALL
    -- Invitaciones casuales aceptadas y ya pasadas
    SELECT
      CASE WHEN mi.inviter_user_id = v_uid THEN mi.invitee_user_id ELSE mi.inviter_user_id END,
      COALESCE((mi.selected_slot->>'starts_at')::timestamptz, mi.responded_at),
      'casual'::text
    FROM public.match_invitations mi
    WHERE mi.tenant_id = v_tenant
      AND mi.status = 'accepted'
      AND (mi.inviter_user_id = v_uid OR mi.invitee_user_id = v_uid)
  ),
  ranked AS (
    SELECT partner_id, MAX(played_at) AS last_played, MAX(src) AS src
    FROM partners
    WHERE partner_id IS NOT NULL AND partner_id <> v_uid
    GROUP BY partner_id
  )
  SELECT
    p.user_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    r.last_played,
    r.src
  FROM ranked r
  JOIN public.profiles p ON p.user_id = r.partner_id
  ORDER BY r.last_played DESC NULLS LAST
  LIMIT _limit;
END $$;

-- =========================================================
-- RPC: compute_partner_compatibility
-- =========================================================
CREATE OR REPLACE FUNCTION public.compute_partner_compatibility(_me uuid, _them uuid)
RETURNS int
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_my_level numeric;
  v_their_level numeric;
  v_diff numeric;
  v_utr_score numeric;
  v_overlap_minutes numeric := 0;
  v_calendar_score numeric;
  v_recent_pen numeric := 0;
  v_my_matches int;
  v_their_matches int;
BEGIN
  SELECT level, matches_played INTO v_my_level, v_my_matches
  FROM public.player_ratings WHERE user_id = _me LIMIT 1;
  SELECT level, matches_played INTO v_their_level, v_their_matches
  FROM public.player_ratings WHERE user_id = _them LIMIT 1;

  IF v_my_matches IS NULL OR v_their_matches IS NULL OR v_my_matches < 3 OR v_their_matches < 3 THEN
    RETURN NULL; -- en calibración
  END IF;

  v_diff := ABS(COALESCE(v_my_level,0) - COALESCE(v_their_level,0));
  v_utr_score := GREATEST(0, 100 - v_diff * 25);

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(a.ends_at, b.ends_at) - GREATEST(a.starts_at, b.starts_at))) / 60), 0)
  INTO v_overlap_minutes
  FROM public.user_availability a
  JOIN public.user_availability b
    ON a.weekday = b.weekday
   AND a.starts_at < b.ends_at
   AND b.starts_at < a.ends_at
  WHERE a.user_id = _me AND b.user_id = _them
    AND a.is_active AND b.is_active;

  v_calendar_score := LEAST(100, (v_overlap_minutes / 60.0) / 8.0 * 100);

  IF EXISTS (
    SELECT 1 FROM public.ladder_challenges c
    WHERE c.tenant_id = user_tenant_id(_me)
      AND c.played_at > now() - interval '14 days'
      AND ((c.challenger_user_id = _me AND c.challenged_user_id = _them)
        OR (c.challenger_user_id = _them AND c.challenged_user_id = _me))
  ) THEN
    v_recent_pen := -10;
  END IF;

  RETURN GREATEST(0, LEAST(100, ROUND(v_utr_score * 0.6 + v_calendar_score * 0.3 + v_recent_pen)));
END $$;

-- =========================================================
-- RPC: get_partner_suggestions
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_partner_suggestions(_limit int DEFAULT 12)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  level numeric,
  level_diff numeric,
  compat_score int,
  reasons text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid := user_tenant_id(v_uid);
  v_my_level numeric;
  v_filters public.match_search_filters;
BEGIN
  SELECT level INTO v_my_level FROM public.player_ratings WHERE user_id = v_uid LIMIT 1;
  SELECT * INTO v_filters FROM public.match_search_filters WHERE user_id = v_uid;

  RETURN QUERY
  SELECT
    p.user_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    pr.level,
    ABS(COALESCE(pr.level,0) - COALESCE(v_my_level,0)) AS level_diff,
    public.compute_partner_compatibility(v_uid, p.user_id) AS compat_score,
    ARRAY[]::text[] AS reasons
  FROM public.profiles p
  LEFT JOIN public.player_ratings pr ON pr.user_id = p.user_id
  WHERE p.tenant_id = v_tenant
    AND p.user_id <> v_uid
  ORDER BY compat_score DESC NULLS LAST, level_diff ASC
  LIMIT _limit;
END $$;

-- =========================================================
-- RPC: create_match_invitation
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_match_invitation(
  _invitee_user_id uuid,
  _slots jsonb,
  _message text DEFAULT NULL
)
RETURNS public.match_invitations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid := user_tenant_id(v_uid);
  v_invitee_tenant uuid;
  v_score int;
  v_existing public.match_invitations;
  v_new public.match_invitations;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _invitee_user_id = v_uid THEN RAISE EXCEPTION 'No puedes invitarte a ti mismo'; END IF;
  IF jsonb_typeof(_slots) <> 'array' OR jsonb_array_length(_slots) = 0 OR jsonb_array_length(_slots) > 3 THEN
    RAISE EXCEPTION 'Debes proponer entre 1 y 3 horarios';
  END IF;

  SELECT tenant_id INTO v_invitee_tenant FROM public.profiles WHERE user_id = _invitee_user_id;
  IF v_invitee_tenant IS NULL OR v_invitee_tenant <> v_tenant THEN
    RAISE EXCEPTION 'Socio no encontrado en tu club';
  END IF;

  -- Auto-match si hay invitación recíproca <1h pendiente
  SELECT * INTO v_existing
  FROM public.match_invitations
  WHERE inviter_user_id = _invitee_user_id
    AND invitee_user_id = v_uid
    AND status = 'pending'
    AND created_at > now() - interval '1 hour'
  ORDER BY created_at DESC LIMIT 1;

  v_score := public.compute_partner_compatibility(v_uid, _invitee_user_id);

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.match_invitations
       SET status = 'accepted',
           selected_slot = (_slots->0),
           responded_at = now()
     WHERE id = v_existing.id
     RETURNING * INTO v_existing;

    INSERT INTO public.user_notifications (user_id, tenant_id, kind, title, body, ref_id)
    VALUES
      (v_existing.inviter_user_id, v_tenant, 'partner_invitation_accepted', 'Hay Partner', 'Auto-match con socio', v_existing.id),
      (v_uid, v_tenant, 'partner_invitation_accepted', 'Hay Partner', 'Auto-match con socio', v_existing.id);

    RETURN v_existing;
  END IF;

  INSERT INTO public.match_invitations (
    tenant_id, inviter_user_id, invitee_user_id, proposed_slots, message, compat_score
  ) VALUES (
    v_tenant, v_uid, _invitee_user_id, _slots, _message, v_score
  ) RETURNING * INTO v_new;

  INSERT INTO public.user_notifications (user_id, tenant_id, kind, title, body, ref_id)
  VALUES (_invitee_user_id, v_tenant, 'partner_invitation_received', 'Nueva invitación de partido', COALESCE(_message,'Te invitaron a jugar'), v_new.id);

  RETURN v_new;
END $$;

-- =========================================================
-- RPC: respond_match_invitation
-- =========================================================
CREATE OR REPLACE FUNCTION public.respond_match_invitation(
  _invitation_id uuid,
  _selected_slot jsonb,
  _accept boolean
)
RETURNS public.match_invitations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.match_invitations;
BEGIN
  SELECT * INTO v_inv FROM public.match_invitations WHERE id = _invitation_id;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invitación no encontrada'; END IF;
  IF v_inv.invitee_user_id <> v_uid THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitación ya procesada'; END IF;

  UPDATE public.match_invitations
     SET status = CASE WHEN _accept THEN 'accepted'::partner_invitation_status ELSE 'rejected'::partner_invitation_status END,
         selected_slot = CASE WHEN _accept THEN _selected_slot ELSE NULL END,
         responded_at = now()
   WHERE id = _invitation_id
   RETURNING * INTO v_inv;

  INSERT INTO public.user_notifications (user_id, tenant_id, kind, title, body, ref_id)
  VALUES (
    v_inv.inviter_user_id, v_inv.tenant_id,
    CASE WHEN _accept THEN 'partner_invitation_accepted' ELSE 'partner_invitation_rejected' END,
    CASE WHEN _accept THEN 'Aceptaron tu invitación' ELSE 'Rechazaron tu invitación' END,
    NULL, v_inv.id
  );

  RETURN v_inv;
END $$;

-- =========================================================
-- RPC: expire_match_invitations
-- =========================================================
CREATE OR REPLACE FUNCTION public.expire_match_invitations()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM public.match_invitations
    WHERE status = 'pending' AND expires_at < now()
  LOOP
    UPDATE public.match_invitations SET status = 'expired' WHERE id = r.id;
    INSERT INTO public.user_notifications (user_id, tenant_id, kind, title, body, ref_id)
    VALUES
      (r.inviter_user_id, r.tenant_id, 'partner_invitation_expired', 'Invitación expirada', 'Tu invitación venció sin respuesta', r.id),
      (r.invitee_user_id, r.tenant_id, 'partner_invitation_expired', 'Invitación expirada', 'Una invitación pendiente venció', r.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- =========================================================
-- RPC: create_match_open_post
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_match_open_post(
  _format partner_match_format,
  _available_slots jsonb,
  _note text DEFAULT NULL
)
RETURNS public.match_open_posts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid := user_tenant_id(v_uid);
  v_new public.match_open_posts;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF jsonb_typeof(_available_slots) <> 'array' OR jsonb_array_length(_available_slots) = 0 THEN
    RAISE EXCEPTION 'Debes ofrecer al menos un horario';
  END IF;

  INSERT INTO public.match_open_posts (tenant_id, user_id, format, available_slots, note)
  VALUES (v_tenant, v_uid, _format, _available_slots, _note)
  RETURNING * INTO v_new;
  RETURN v_new;
END $$;

-- =========================================================
-- RPC: respond_match_open_post
-- =========================================================
CREATE OR REPLACE FUNCTION public.respond_match_open_post(
  _post_id uuid,
  _selected_slot jsonb,
  _message text DEFAULT NULL
)
RETURNS public.match_post_responses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post public.match_open_posts;
  v_resp public.match_post_responses;
BEGIN
  SELECT * INTO v_post FROM public.match_open_posts WHERE id = _post_id;
  IF v_post.id IS NULL OR v_post.status <> 'open' THEN RAISE EXCEPTION 'Post no disponible'; END IF;
  IF v_post.user_id = v_uid THEN RAISE EXCEPTION 'No puedes responder tu propio post'; END IF;

  INSERT INTO public.match_post_responses (tenant_id, post_id, responder_user_id, selected_slot, message)
  VALUES (v_post.tenant_id, _post_id, v_uid, _selected_slot, _message)
  RETURNING * INTO v_resp;

  INSERT INTO public.user_notifications (user_id, tenant_id, kind, title, body, ref_id)
  VALUES (v_post.user_id, v_post.tenant_id, 'partner_post_response', 'Respondieron tu Busco Partner', NULL, v_resp.id);

  RETURN v_resp;
END $$;
