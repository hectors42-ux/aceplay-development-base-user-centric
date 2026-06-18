
ALTER TABLE public.profiles ALTER COLUMN theme SET DEFAULT 'etat-francais';
UPDATE public.profiles SET theme = 'etat-francais' WHERE theme = 'terre-battue';
