ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'terre-battue'
    CHECK (theme IN ('terre-battue','etat-francais')),
  ADD COLUMN IF NOT EXISTS theme_mode TEXT NOT NULL DEFAULT 'light'
    CHECK (theme_mode IN ('light','dark','system'));