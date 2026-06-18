
-- PRD 9 · Activar mi nivel

-- 1. Extender profiles con campos de membresía
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_type text NOT NULL DEFAULT 'guest',
  ADD COLUMN IF NOT EXISTS membership_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS membership_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS membership_source_tournament uuid;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_membership_type_chk
    CHECK (membership_type IN ('guest','trial','member'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_membership_source_tournament_fkey
    FOREIGN KEY (membership_source_tournament) REFERENCES public.tournaments(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS profiles_membership_expires_at_idx
  ON public.profiles (membership_expires_at)
  WHERE membership_type = 'trial';

-- 2. Tabla de ofertas de captación por torneo
CREATE TABLE IF NOT EXISTS public.tournament_membership_offer (
  tournament_id uuid PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
  offer_type text NOT NULL CHECK (offer_type IN ('trial_30d','discount_first_month','free_first_class')),
  offer_label text NOT NULL,
  offer_terms_md text,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tournament_membership_offer TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_membership_offer TO authenticated;
GRANT ALL ON public.tournament_membership_offer TO service_role;

ALTER TABLE public.tournament_membership_offer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active offers"
  ON public.tournament_membership_offer FOR SELECT
  USING (active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Managers can manage offers"
  ON public.tournament_membership_offer FOR ALL
  TO authenticated
  USING (public.is_tournament_manager(tournament_id))
  WITH CHECK (public.is_tournament_manager(tournament_id));

CREATE TRIGGER trg_tmo_updated_at
  BEFORE UPDATE ON public.tournament_membership_offer
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RPC público: obtener oferta activa de un torneo
CREATE OR REPLACE FUNCTION public.get_tournament_membership_offer(_tournament_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(o)
  FROM public.tournament_membership_offer o
  WHERE o.tournament_id = _tournament_id
    AND o.active = true
    AND (o.expires_at IS NULL OR o.expires_at > now())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_tournament_membership_offer(uuid) TO anon, authenticated;

-- 4. RPC: activar trial
CREATE OR REPLACE FUNCTION public.activate_trial_membership(
  _tournament_id uuid,
  _phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_profile record;
  v_offer record;
  v_tenant uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_offer
    FROM public.tournament_membership_offer
   WHERE tournament_id = _tournament_id
     AND active = true
     AND (expires_at IS NULL OR expires_at > now());

  IF v_offer.tournament_id IS NULL THEN
    RAISE EXCEPTION 'No active offer';
  END IF;

  SELECT tenant_id INTO v_tenant FROM public.tournaments WHERE id = _tournament_id;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user;

  -- Idempotente: no degradar member a trial
  IF v_profile.membership_type = 'member' THEN
    RETURN jsonb_build_object('status', 'already_member');
  END IF;

  UPDATE public.profiles
     SET membership_type = 'trial',
         membership_activated_at = COALESCE(membership_activated_at, now()),
         membership_expires_at = now() + interval '30 days',
         membership_source_tournament = _tournament_id,
         phone = COALESCE(_phone, phone),
         tenant_id = COALESCE(tenant_id, v_tenant)
   WHERE user_id = v_user;

  INSERT INTO public.tournament_events (tournament_id, kind, payload, actor_id)
  VALUES (_tournament_id, 'guest_to_member_converted',
          jsonb_build_object('user_id', v_user, 'offer_type', v_offer.offer_type),
          v_user);

  INSERT INTO public.analytics_events (event_name, user_id, event_props)
  VALUES ('guest_to_member_converted', v_user,
          jsonb_build_object('tournament_id', _tournament_id, 'offer_type', v_offer.offer_type));

  RETURN jsonb_build_object(
    'status', 'activated',
    'expires_at', (now() + interval '30 days')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_trial_membership(uuid, text) TO authenticated;

-- 5. Límite mensual de reservas para trial (máx 2/mes)
CREATE OR REPLACE FUNCTION public.enforce_trial_booking_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_count int;
BEGIN
  SELECT membership_type INTO v_type
    FROM public.profiles WHERE user_id = NEW.user_id;

  IF v_type <> 'trial' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.bookings
   WHERE user_id = NEW.user_id
     AND date_trunc('month', start_at) = date_trunc('month', NEW.start_at);

  IF v_count >= 2 THEN
    RAISE EXCEPTION 'Trial membership: máximo 2 reservas por mes alcanzado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_trial_booking_limit ON public.bookings;
CREATE TRIGGER trg_enforce_trial_booking_limit
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_trial_booking_limit();
