-- ÉPICA K: calendario estacional de temas, editable por admin (economy_config).
-- El ThemeProvider lee esta fila; si falta, usa el default del util. Cambiar de
-- tema (incl. seasonal) NO toca rating/xp/fichas — es 100% preferencia visual.
insert into public.economy_config (key, value)
values (
  'seasonal_theme_calendar',
  '[
    {"month":1,"day":1,"theme":"cement"},
    {"month":4,"day":1,"theme":"clay"},
    {"month":7,"day":1,"theme":"grass"},
    {"month":8,"day":15,"theme":"cement"},
    {"month":12,"day":1,"theme":"arena"}
  ]'::jsonb
)
on conflict (key) do update set value = excluded.value;

-- Seed demo: 1 perfil en cada tema nuevo (incluido 'seasonal'). Idempotente.
update public.profiles set theme = 'cement'   where id = (select id from auth.users where email = 'demo02@demo.local');
update public.profiles set theme = 'clay'     where id = (select id from auth.users where email = 'demo03@demo.local');
update public.profiles set theme = 'grass'    where id = (select id from auth.users where email = 'demo04@demo.local');
update public.profiles set theme = 'seasonal' where id = (select id from auth.users where email = 'demo05@demo.local');
