
-- Fix: tg_match_open_post_complete usaba enum value 'confirmed' que no existe.
-- partner_post_status = ('open','matched','expired','cancelled')
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
    UPDATE public.match_open_posts
      SET status = 'matched', updated_at = now()
      WHERE id = NEW.post_id;
  END IF;

  RETURN NEW;
END;
$$;
