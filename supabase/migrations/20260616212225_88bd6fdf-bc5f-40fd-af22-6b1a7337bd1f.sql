
CREATE OR REPLACE FUNCTION public.notify_tournament_drawing_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        WHERE tournament_category_id = NEW.id AND status = 'confirmada' AND player1_user_id IS NOT NULL
      UNION
      SELECT player2_user_id FROM public.tournament_registrations
        WHERE tournament_category_id = NEW.id AND status = 'confirmada' AND player2_user_id IS NOT NULL
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
$function$;
