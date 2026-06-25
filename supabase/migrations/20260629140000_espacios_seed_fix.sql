-- ÉPICA N · Espacios — fix del seed: para que la tarjeta de Stade Français resuelva
-- su club, el space del TORNEO intermedio debe ser legible por demouser (la cadena
-- categoría→torneo→club lo necesita). demouser era miembro del club y de la categoría,
-- pero no del torneo. Lo agregamos + dejamos el club 'hierarchy' (descubrible para
-- sus miembros). Solo datos; no toca el motor.
do $$
declare _me uuid; _tour uuid; _club uuid;
begin
  select id into _me from auth.users where email = 'demouser@aceplay.cl';
  select id into _tour from public.space where slug = 'torneo-stade';
  select id into _club from public.space where slug = 'stade-francais';
  if _me is null or _tour is null then return; end if;

  insert into public.space_membership (player_id, space_id, role, status)
  values (_me, _tour, 'player', 'active')
  on conflict (player_id, space_id) do nothing;

  update public.space set visibility = 'hierarchy' where id in (_club, _tour);
end $$;

notify pgrst, 'reload schema';
