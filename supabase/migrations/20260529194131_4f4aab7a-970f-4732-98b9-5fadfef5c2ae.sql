-- ============================================================
-- Fase C: doubles + padel (pair_vs_pair, open_slots 4 cupos)
-- ============================================================

ALTER TABLE public.match_open_posts
  ADD COLUMN IF NOT EXISTS partner_user_id uuid;

-- ============================================================
-- Trigger seed_slots actualizado: si pair_vs_pair + doubles → llena slot 1 del team1 con partner_user_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_match_open_post_seed_slots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i smallint;
  per_team smallint;
BEGIN
  per_team := CASE WHEN NEW.match_type = 'singles' THEN 1 ELSE 2 END;

  -- team 1
  FOR i IN 0..(per_team - 1) LOOP
    INSERT INTO public.match_open_post_slots(post_id, team, slot_index, user_id, joined_at)
    VALUES (
      NEW.id, 1, i,
      CASE
        WHEN i = 0 THEN NEW.user_id
        WHEN i = 1 AND NEW.mode = 'pair_vs_pair' AND NEW.partner_user_id IS NOT NULL THEN NEW.partner_user_id
        ELSE NULL
      END,
      CASE
        WHEN i = 0 THEN now()
        WHEN i = 1 AND NEW.mode = 'pair_vs_pair' AND NEW.partner_user_id IS NOT NULL THEN now()
        ELSE NULL
      END
    );
  END LOOP;

  -- team 2
  FOR i IN 0..(per_team - 1) LOOP
    INSERT INTO public.match_open_post_slots(post_id, team, slot_index, user_id, joined_at)
    VALUES (NEW.id, 2, i, NULL, NULL);
  END LOOP;

  RETURN NEW;
END;
$$;

-- ============================================================
-- RPC join_open_match con soporte de pair_vs_pair
-- ============================================================
DROP FUNCTION IF EXISTS public.join_open_match(uuid, smallint);

CREATE OR REPLACE FUNCTION public.join_open_match(
  _post_id uuid,
  _slot_index smallint DEFAULT NULL,
  _partner_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post public.match_open_posts;
  v_slot public.match_open_post_slots;
  v_slot2 public.match_open_post_slots;
  v_rating numeric;
  v_partner_rating numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_post FROM public.match_open_posts WHERE id = _post_id FOR UPDATE;
  IF v_post.id IS NULL THEN RAISE EXCEPTION 'Reto no encontrado'; END IF;
  IF v_post.status <> 'open' THEN RAISE EXCEPTION 'Reto ya no está disponible'; END IF;
  IF v_post.expires_at <= now() THEN RAISE EXCEPTION 'Reto expirado'; END IF;
  IF v_post.user_id = v_uid THEN RAISE EXCEPTION 'No puedes unirte a tu propio reto'; END IF;
  IF v_post.tenant_id <> user_tenant_id(v_uid) THEN RAISE EXCEPTION 'Reto fuera de tu club'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_open_post_slots
    WHERE post_id = _post_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Ya estás en este reto';
  END IF;

  -- validar nivel del que se une
  IF v_post.level_min IS NOT NULL OR v_post.level_max IS NOT NULL THEN
    SELECT level INTO v_rating FROM public.player_ratings
    WHERE user_id = v_uid AND tenant_id = v_post.tenant_id
    ORDER BY updated_at DESC LIMIT 1;
    IF v_rating IS NULL THEN RAISE EXCEPTION 'Necesitas un nivel registrado'; END IF;
    IF v_post.level_min IS NOT NULL AND v_rating < v_post.level_min THEN
      RAISE EXCEPTION 'Tu nivel es menor al pedido';
    END IF;
    IF v_post.level_max IS NOT NULL AND v_rating > v_post.level_max THEN
      RAISE EXCEPTION 'Tu nivel es mayor al pedido';
    END IF;
  END IF;

  -- ========================
  -- MODO pair_vs_pair (dobles)
  -- ========================
  IF v_post.mode = 'pair_vs_pair' THEN
    IF _partner_user_id IS NULL THEN
      RAISE EXCEPTION 'Debes elegir una pareja';
    END IF;
    IF _partner_user_id = v_uid THEN
      RAISE EXCEPTION 'No puedes ser tu propia pareja';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.match_open_post_slots
      WHERE post_id = _post_id AND user_id = _partner_user_id
    ) THEN
      RAISE EXCEPTION 'Esa pareja ya está en este reto';
    END IF;
    -- partner debe pertenecer al mismo club
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = _partner_user_id AND tenant_id = v_post.tenant_id
    ) THEN
      RAISE EXCEPTION 'La pareja no es del mismo club';
    END IF;
    -- validar nivel de la pareja
    IF v_post.level_min IS NOT NULL OR v_post.level_max IS NOT NULL THEN
      SELECT level INTO v_partner_rating FROM public.player_ratings
      WHERE user_id = _partner_user_id AND tenant_id = v_post.tenant_id
      ORDER BY updated_at DESC LIMIT 1;
      IF v_partner_rating IS NULL THEN RAISE EXCEPTION 'Tu pareja no tiene nivel registrado'; END IF;
      IF v_post.level_min IS NOT NULL AND v_partner_rating < v_post.level_min THEN
        RAISE EXCEPTION 'El nivel de tu pareja es menor al pedido';
      END IF;
      IF v_post.level_max IS NOT NULL AND v_partner_rating > v_post.level_max THEN
        RAISE EXCEPTION 'El nivel de tu pareja es mayor al pedido';
      END IF;
    END IF;

    -- tomar ambos slots libres del team 2
    SELECT * INTO v_slot FROM public.match_open_post_slots
    WHERE post_id = _post_id AND team = 2 AND slot_index = 0 AND user_id IS NULL
    FOR UPDATE LIMIT 1;
    SELECT * INTO v_slot2 FROM public.match_open_post_slots
    WHERE post_id = _post_id AND team = 2 AND slot_index = 1 AND user_id IS NULL
    FOR UPDATE LIMIT 1;
    IF v_slot.id IS NULL OR v_slot2.id IS NULL THEN
      RAISE EXCEPTION 'Los cupos rivales ya están tomados';
    END IF;

    UPDATE public.match_open_post_slots
    SET user_id = v_uid, joined_at = now()
    WHERE id = v_slot.id;
    UPDATE public.match_open_post_slots
    SET user_id = _partner_user_id, joined_at = now(), invited_by = v_uid
    WHERE id = v_slot2.id;

    RETURN jsonb_build_object(
      'post_id', _post_id,
      'joined_team', 2,
      'joined_slot', 0,
      'partner_slot', 1
    );
  END IF;

  -- ========================
  -- MODO open_slots (singles o doubles)
  -- ========================
  IF _slot_index IS NOT NULL THEN
    SELECT * INTO v_slot FROM public.match_open_post_slots
    WHERE post_id = _post_id AND slot_index = _slot_index AND user_id IS NULL
    ORDER BY team
    FOR UPDATE SKIP LOCKED LIMIT 1;
  ELSE
    SELECT * INTO v_slot FROM public.match_open_post_slots
    WHERE post_id = _post_id AND user_id IS NULL
    ORDER BY team, slot_index
    FOR UPDATE SKIP LOCKED LIMIT 1;
  END IF;

  IF v_slot.id IS NULL THEN
    RAISE EXCEPTION 'No hay cupos disponibles';
  END IF;

  UPDATE public.match_open_post_slots
  SET user_id = v_uid, joined_at = now()
  WHERE id = v_slot.id;

  RETURN jsonb_build_object(
    'post_id', _post_id,
    'joined_team', v_slot.team,
    'joined_slot', v_slot.slot_index
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_open_match(uuid, smallint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_open_match(uuid, smallint, uuid) TO authenticated;