-- ÉPICA N · Espacios — branding de club + limpieza del demo a 2 tarjetas.
-- (1) Marca por club en club_profile.branding (jsonb existente): logo + color primario.
--     Es el lugar donde el club expone su marca en la app. Solo datos.
-- (2) Limpieza: demouser deja las competencias del "AcePlay Demo Club" para que
--     Espacios muestre exactamente las 2 tarjetas branded (Providencia + Stade).
do $$
declare _me uuid; _democlub uuid; _prov uuid; _stade uuid;
begin
  select id into _me from auth.users where email = 'demouser@aceplay.cl';
  select id into _prov from public.space where slug = 'club-providencia';
  select id into _stade from public.space where slug = 'stade-francais';

  -- (1) Branding por club (logo dominante #b2674a de Providencia; navy/azul de Stade).
  if _prov is not null then
    insert into public.club_profile (space_id, branding)
    values (_prov, jsonb_build_object('logo_url', '/club-providencia.png', 'primary', '#b2674a'))
    on conflict (space_id) do update set branding = excluded.branding;
  end if;
  if _stade is not null then
    insert into public.club_profile (space_id, branding)
    values (_stade, jsonb_build_object('logo_url', null, 'primary', '#1e3a6f', 'initials', 'SF'))
    on conflict (space_id) do update set branding = excluded.branding;
  end if;

  -- (2) Limpieza: quitar a demouser de las competencias del AcePlay Demo Club.
  select id into _democlub from public.space where slug = 'demo-club' and type = 'club';
  if _democlub is not null and _me is not null then
    delete from public.space_membership
    where player_id = _me
      and space_id in (
        select s.id from public.space s
        where s.parent_space_id = _democlub
           or s.parent_space_id in (select id from public.space where parent_space_id = _democlub)
      );
  end if;
end $$;

notify pgrst, 'reload schema';
