ALTER TABLE public.tournament_categories
  ADD COLUMN sport     public.tournament_sport    NOT NULL DEFAULT 'tenis',
  ADD COLUMN modality  public.tournament_modality NOT NULL DEFAULT 'singles',
  ADD COLUMN motor     public.competition_motor   NOT NULL DEFAULT 'eliminacion_simple';

UPDATE public.tournament_categories
SET sport='tenis', modality='singles' WHERE discipline='tenis_singles';
UPDATE public.tournament_categories
SET sport='tenis', modality='dobles'  WHERE discipline='tenis_dobles';
UPDATE public.tournament_categories
SET sport='padel', modality='dobles'  WHERE discipline='padel_dobles';

ALTER TABLE public.tournament_categories
  ADD CONSTRAINT chk_padel_es_dobles
  CHECK (NOT (sport='padel' AND modality='singles'));