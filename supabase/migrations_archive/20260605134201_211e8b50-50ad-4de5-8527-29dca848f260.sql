ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_theme_check;
UPDATE public.profiles SET theme = 'us-open' WHERE theme = 'etat-francais';
ALTER TABLE public.profiles ALTER COLUMN theme SET DEFAULT 'us-open';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_theme_check CHECK (theme = ANY (ARRAY['terre-battue'::text, 'us-open'::text, 'wimbledon'::text]));