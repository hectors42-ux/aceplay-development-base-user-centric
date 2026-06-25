-- ÉPICA N · Espacios — logo oficial de Stade Français en su tarjeta.
-- Correctivo sobre la BD viva: la marca de Stade ya existía con iniciales; ahora
-- apunta al logo real (asset del club en public/). Merge para no perder el color.
update public.club_profile
set branding = branding || jsonb_build_object('logo_url', '/stade-francais.webp')
where space_id = (select id from public.space where slug = 'stade-francais');

notify pgrst, 'reload schema';
