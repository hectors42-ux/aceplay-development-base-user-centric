-- ============================================================
-- Fase B: match_open_post_slots + triggers + RPCs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.match_open_post_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.match_open_posts(id) ON DELETE CASCADE,
  team        smallint NOT NULL CHECK (team IN (1,2)),
  slot_index  smallint NOT NULL CHECK (slot_index >= 0),
  user_id     uuid,
  joined_at   timestamptz,
  invited_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, team, slot_index)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mops_post_user
  ON public.match_open_post_slots(post_id, user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mops_post ON public.match_open_post_slots(post_id);

GRANT SELECT ON public.match_open_post_slots TO authenticated;
GRANT ALL    ON public.match_open_post_slots TO service_role;

ALTER TABLE public.match_open_post_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mops_club_read" ON public.match_open_post_slots;
CREATE POLICY "mops_club_read" ON public.match_open_post_slots
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.match_open_posts p
    WHERE p.id = post_id
      AND (p.tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  ));
-- escritura solo vía RPC SECURITY DEFINER

-- ============================================================
-- Trigger: seed slots al crear un post
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
      CASE WHEN i = 0 THEN NEW.user_id ELSE NULL END,
      CASE WHEN i = 0 THEN now() ELSE NULL END
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

DROP TRIGGER IF EXISTS trg_mop_seed_slots ON public.match_open_posts;
CREATE TRIGGER trg_mop_seed_slots
AFTER INSERT ON public.match_open_posts
FOR EACH ROW EXECUTE FUNCTION public.tg_match_open_post_seed_slots();

-- Backfill: posts existentes sin slots → crear slots ahora
INSERT INTO public.match_open_post_slots(post_id, team, slot_index, user_id, joined_at)
SELECT p.id, 1, 0, p.user_id, p.created_at
FROM public.match_open_posts p
WHERE NOT EXISTS (SELECT 1 FROM public.match_open_post_slots s WHERE s.post_id = p.id);
INSERT INTO public.match_open_post_slots(post_id, team, slot_index, user_id, joined_at)
SELECT p.id, 2, 0, NULL, NULL
FROM public.match_open_posts p
WHERE NOT EXISTS (
  SELECT 1 FROM public.match_open_post_slots s WHERE s.post_id = p.id AND s.team = 2
);

-- ============================================================
-- Trigger: marcar post como confirmado al llenar todos los slots
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_match_open_post_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_filled int;
  v_post public.match_open_posts;
BEGIN
  SELECT * INTO v_post FROM public.match_open_posts WHERE id = NEW.post_id;
  IF v_post.id IS NULL OR v_post.status <> 'open' THEN
    RETURN NEW;
  END IF;

  SELECT count(*), count(user_id) INTO v_total, v_filled
  FROM public.match_open_post_slots WHERE post_id = NEW.post_id;

  IF v_filled = v_total AND v_total > 0 THEN
    UPDATE public.match_open_posts SET status = 'confirmed', updated_at = now() WHERE id = NEW.post_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mop_complete ON public.match_open_post_slots;
CREATE TRIGGER trg_mop_complete
AFTER UPDATE OF user_id ON public.match_open_post_slots
FOR EACH ROW EXECUTE FUNCTION public.tg_match_open_post_complete();

-- ============================================================
-- RPC: join_open_match
-- ============================================================
CREATE OR REPLACE FUNCTION public.join_open_match(_post_id uuid, _slot_index smallint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post public.match_open_posts;
  v_slot public.match_open_post_slots;
  v_rating numeric;
  v_gender text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_post FROM public.match_open_posts WHERE id = _post_id FOR UPDATE;
  IF v_post.id IS NULL THEN
    RAISE EXCEPTION 'Reto no encontrado';
  END IF;
  IF v_post.status <> 'open' THEN
    RAISE EXCEPTION 'Reto ya no está disponible';
  END IF;
  IF v_post.expires_at <= now() THEN
    RAISE EXCEPTION 'Reto expirado';
  END IF;
  IF v_post.user_id = v_uid THEN
    RAISE EXCEPTION 'No puedes unirte a tu propio reto';
  END IF;
  IF v_post.tenant_id <> user_tenant_id(v_uid) THEN
    RAISE EXCEPTION 'Reto fuera de tu club';
  END IF;

  -- duplicado
  IF EXISTS (
    SELECT 1 FROM public.match_open_post_slots
    WHERE post_id = _post_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Ya estás en este reto';
  END IF;

  -- filtro nivel
  IF v_post.level_min IS NOT NULL OR v_post.level_max IS NOT NULL THEN
    SELECT level INTO v_rating FROM public.player_ratings
    WHERE user_id = v_uid AND tenant_id = v_post.tenant_id
    ORDER BY updated_at DESC LIMIT 1;
    IF v_rating IS NULL THEN
      RAISE EXCEPTION 'Necesitas un nivel registrado';
    END IF;
    IF v_post.level_min IS NOT NULL AND v_rating < v_post.level_min THEN
      RAISE EXCEPTION 'Tu nivel es menor al pedido';
    END IF;
    IF v_post.level_max IS NOT NULL AND v_rating > v_post.level_max THEN
      RAISE EXCEPTION 'Tu nivel es mayor al pedido';
    END IF;
  END IF;

  -- tomar slot libre
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

REVOKE ALL ON FUNCTION public.join_open_match(uuid, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_open_match(uuid, smallint) TO authenticated;

-- ============================================================
-- RPC: leave_open_match
-- ============================================================
CREATE OR REPLACE FUNCTION public.leave_open_match(_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post public.match_open_posts;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_post FROM public.match_open_posts WHERE id = _post_id;
  IF v_post.id IS NULL THEN RAISE EXCEPTION 'Reto no encontrado'; END IF;
  IF v_post.status <> 'open' THEN RAISE EXCEPTION 'Reto ya cerrado'; END IF;
  IF v_post.user_id = v_uid THEN
    RAISE EXCEPTION 'El autor no puede salirse; usa cancelar';
  END IF;

  UPDATE public.match_open_post_slots
  SET user_id = NULL, joined_at = NULL, invited_by = NULL
  WHERE post_id = _post_id AND user_id = v_uid;

  RETURN jsonb_build_object('post_id', _post_id, 'left', true);
END;
$$;

REVOKE ALL ON FUNCTION public.leave_open_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_open_match(uuid) TO authenticated;

-- ============================================================
-- RPC: cancel_open_match
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_open_match(_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post public.match_open_posts;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_post FROM public.match_open_posts WHERE id = _post_id;
  IF v_post.id IS NULL THEN RAISE EXCEPTION 'Reto no encontrado'; END IF;
  IF v_post.user_id <> v_uid AND NOT is_club_admin_of(v_uid, v_post.tenant_id) THEN
    RAISE EXCEPTION 'Solo el autor puede cancelar';
  END IF;
  UPDATE public.match_open_posts SET status = 'cancelled', updated_at = now() WHERE id = _post_id;
  RETURN jsonb_build_object('post_id', _post_id, 'cancelled', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_open_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_open_match(uuid) TO authenticated;