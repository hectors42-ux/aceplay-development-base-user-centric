-- ÉPICA N · Espacios — branding de club CONFIGURABLE por el admin/organizador.
-- set_club_branding actualiza la marca (logo + color) del club del que el caller es
-- organizador/admin (my_organizer_club). Es el lugar donde el club expone su marca.
-- Solo perfiles que pueden crear clubes/torneos/escalerillas (organizador/admin).
create or replace function public.set_club_branding(_logo_url text default null, _primary text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare _club uuid; _patch jsonb;
begin
  _club := public.my_organizer_club();
  if _club is null then
    raise exception 'Necesitas perfil de organizador o admin de un club para configurar su marca';
  end if;
  _patch := jsonb_strip_nulls(jsonb_build_object('logo_url', _logo_url, 'primary', _primary));
  insert into public.club_profile (space_id, branding)
  values (_club, _patch)
  on conflict (space_id) do update set branding = public.club_profile.branding || _patch;
end $$;

grant execute on function public.set_club_branding(text, text) to authenticated;

notify pgrst, 'reload schema';
