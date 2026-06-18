CREATE OR REPLACE FUNCTION public.tournament_signals_feed()
RETURNS TABLE(kind text, ref_id uuid, title text, description text, link text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Racha activa: jugador con >=3 victorias consecutivas en torneo activo.
  RETURN QUERY
  SELECT
    'tournament_streak'::text,
    reg.id,
    ('Racha de ' || reg.consecutive_wins || ' en juego')::text,
    ('Llevas ' || reg.consecutive_wins || ' victorias seguidas en ' ||
      COALESCE(t.name, 'el torneo') || '. Compártelo antes de que se enfríe.')::text,
    ('/torneos/' || t.slug || '/compartir?kind=moment')::text,
    reg.updated_at
  FROM public.tournament_registrations reg
  JOIN public.tournaments t ON t.id = reg.tournament_id
  WHERE reg.consecutive_wins >= 3
    AND (reg.player1_user_id = v_user_id OR reg.player2_user_id = v_user_id)
    AND t.status IN ('en_curso', 'inscripciones_cerradas');

  -- Campeón: posición 1 en última snapshot de una categoría finalizada (últimos 30 días).
  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (ss.category_id, ss.user_id)
      ss.category_id, ss.user_id, ss.position, ss.snapshot_at, ss.tournament_id
    FROM public.standings_snapshots ss
    WHERE ss.user_id = v_user_id
      AND ss.snapshot_at > now() - interval '30 days'
    ORDER BY ss.category_id, ss.user_id, ss.snapshot_at DESC
  )
  SELECT
    'tournament_champion'::text,
    l.category_id,
    'Eres campeón'::text,
    ('Ganaste ' || COALESCE(c.name, 'una categoría') ||
      ' en ' || COALESCE(t.name, 'el torneo') || '. Crea tu tarjeta de campeón.')::text,
    ('/torneos/' || t.slug || '/compartir?kind=champion')::text,
    l.snapshot_at
  FROM latest l
  JOIN public.tournament_categories c ON c.id = l.category_id
  JOIN public.tournaments t ON t.id = l.tournament_id
  WHERE l.position = 1
    AND c.status = 'finalizado';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.tournament_signals_feed() TO authenticated;