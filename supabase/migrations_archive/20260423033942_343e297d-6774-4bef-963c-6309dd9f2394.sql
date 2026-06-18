-- Añade tournament_registrations a la publicación de Realtime y fija REPLICA IDENTITY FULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tournament_registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_registrations;
  END IF;
END $$;

ALTER TABLE public.tournament_registrations REPLICA IDENTITY FULL;