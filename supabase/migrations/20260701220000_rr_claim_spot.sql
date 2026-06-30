-- Camino B como modelo: cada jugador real reclama SU lugar del torneo vía una
-- invitación del organizador (enlace con token). Al reclamar, su cuenta queda
-- vinculada al roster_player y ya puede usar el reto vivo. La carga por el
-- organizador queda solo como respaldo para cupos sin reclamar.

alter table public.roster_players add column if not exists claim_token uuid;
create unique index if not exists roster_players_claim_token_idx
  on public.roster_players (claim_token) where claim_token is not null;

-- Organizador genera (o regenera) el token de invitación de un cupo.
create or replace function public.rr_invite_spot(_roster_player_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _tok uuid;
begin
  if not exists (
    select 1 from public.rr_participant pa
    where pa.roster_player_id = _roster_player_id and public.space_can_manage(pa.category_id)
  ) then
    raise exception 'Solo el organizador puede invitar a este torneo.';
  end if;
  if (select claimed_by from public.roster_players where id = _roster_player_id) is not null then
    raise exception 'Ese cupo ya tiene una cuenta vinculada.';
  end if;
  _tok := gen_random_uuid();
  update public.roster_players set claim_token = _tok where id = _roster_player_id;
  return _tok;
end $$;
grant execute on function public.rr_invite_spot(uuid) to authenticated;

-- El jugador reclama su cupo con el token. Vincula su cuenta (claimed_by) y
-- consume el token. Evita que un usuario tenga 2 cupos en la misma categoría.
create or replace function public.rr_claim_spot(_token uuid)
returns table (category_id uuid, slug text, display_name text)
language plpgsql security definer set search_path = public as $$
declare _rp public.roster_players%rowtype; _cat uuid; _slug text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para reclamar tu lugar.'; end if;
  select * into _rp from public.roster_players where claim_token = _token;
  if not found then raise exception 'Enlace inválido o ya utilizado.'; end if;
  if _rp.claimed_by is not null then raise exception 'Ese lugar ya fue reclamado.'; end if;
  select pa.category_id into _cat from public.rr_participant pa where pa.roster_player_id = _rp.id limit 1;
  if _cat is not null and exists (
    select 1 from public.rr_participant pa
    join public.roster_players r on r.id = pa.roster_player_id
    where pa.category_id = _cat and r.claimed_by = auth.uid()
  ) then
    raise exception 'Ya tienes un lugar en este torneo.';
  end if;
  update public.roster_players set claimed_by = auth.uid(), claim_token = null where id = _rp.id;
  select t.slug into _slug from public.space c join public.space t on t.id = c.parent_space_id where c.id = _cat;
  return query select _cat, _slug, _rp.display_name;
end $$;
grant execute on function public.rr_claim_spot(uuid) to authenticated;

notify pgrst, 'reload schema';
