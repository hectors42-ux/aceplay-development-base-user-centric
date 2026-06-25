-- ÉPICA N · Espacios — bucket para que el organizador SUBA el logo de su club.
-- Lectura pública (el logo se muestra en Espacios/Descubrir). Escritura/borrado solo
-- por owner/admin/organizer del club, en la carpeta {club_id}/... (o admin global).
insert into storage.buckets (id, name, public)
values ('club-logos', 'club-logos', true)
on conflict (id) do nothing;

-- Helper: ¿el caller puede gestionar el branding del club de esta carpeta?
create or replace function public.can_manage_club_folder(_folder text)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1
    from public.space_membership m
    join public.space s on s.id = m.space_id and s.type = 'club'
    where m.space_id::text = _folder
      and m.player_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'organizer')
  );
$$;
grant execute on function public.can_manage_club_folder(text) to authenticated;

drop policy if exists club_logos_public_read on storage.objects;
create policy club_logos_public_read on storage.objects for select
  using (bucket_id = 'club-logos');

drop policy if exists club_logos_insert on storage.objects;
create policy club_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'club-logos' and public.can_manage_club_folder((storage.foldername(name))[1]));

drop policy if exists club_logos_update on storage.objects;
create policy club_logos_update on storage.objects for update to authenticated
  using (bucket_id = 'club-logos' and public.can_manage_club_folder((storage.foldername(name))[1]));

drop policy if exists club_logos_delete on storage.objects;
create policy club_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'club-logos' and public.can_manage_club_folder((storage.foldername(name))[1]));

notify pgrst, 'reload schema';
