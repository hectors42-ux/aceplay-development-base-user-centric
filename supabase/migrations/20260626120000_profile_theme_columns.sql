-- ÉPICA F: persistencia del tema elegido por el usuario en su profile (el
-- ThemeContext ya intentaba escribir profiles.theme/theme_mode, pero las
-- columnas no existían en el core → caía a localStorage). Cambiar tema/modo no
-- toca ningún ledger; es preferencia de look, propiedad del usuario. Cero tenant_id.
alter table public.profiles add column if not exists theme text;
alter table public.profiles add column if not exists theme_mode text;

notify pgrst, 'reload schema';
