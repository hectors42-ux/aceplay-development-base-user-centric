-- HELPERS
create or replace function public.is_member_of_space(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.space_membership
    where space_id = p_space and player_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.can_access_space(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with s as (select path, visibility from public.space where id = p_space)
  select
    (select visibility from s) = 'public'
    or public.is_member_of_space(p_space)
    or exists (
      select 1
      from public.space a
      join public.space_membership m on m.space_id = a.id
      where m.player_id = auth.uid()
        and m.status = 'active'
        and a.visibility = 'hierarchy'
        and a.path @> (select path from s)
    );
$$;

create or replace function public.space_admin(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.space_membership
    where space_id = p_space
      and player_id = auth.uid()
      and status = 'active'
      and role in ('owner','admin','organizer')
  );
$$;

-- PROFILES
create policy profiles_read on public.profiles for select using (true);
create policy profiles_write on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

-- SPACE
create policy space_read on public.space for select using (public.can_access_space(id));
create policy space_insert on public.space for insert with check (organizer_id = auth.uid());
create policy space_update on public.space for update using (organizer_id = auth.uid() or public.space_admin(id));

-- SPACE_MEMBERSHIP
create policy sm_read on public.space_membership for select
  using (player_id = auth.uid() or public.space_admin(space_id));
create policy sm_join on public.space_membership for insert
  with check (player_id = auth.uid() or public.space_admin(space_id));
create policy sm_manage on public.space_membership for update
  using (public.space_admin(space_id) or player_id = auth.uid());

-- SPACE_STANDING
create policy ss_read on public.space_standing for select using (public.can_access_space(space_id));