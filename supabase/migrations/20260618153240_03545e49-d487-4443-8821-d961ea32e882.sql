drop policy if exists sm_read on public.space_membership;
create policy sm_read on public.space_membership for select
  using (player_id = auth.uid() or public.space_admin(space_id) or public.can_access_space(space_id));