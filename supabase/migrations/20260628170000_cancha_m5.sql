-- ÉPICA M · Cancha — M5: cierre del loop (materializar reto + datos del badge).
-- NO reimplementa el motor: record_challenge_result REUSA record_match (crea el
-- partido PENDING; el rating/escalera se mueven SOLO al confirmar, vía el trigger
-- existente). match_victory_card es SOLO LECTURA (presentación del badge).
-- Firewall: ninguna de estas RPCs otorga XP/Fichas ni mueve standings por fuera
-- del motor; el badge no premia nada.

-- 1 · Materializar un reto aceptado en un partido del motor + enlazar challenge.match_id.
--     (Decisión cerrada en M1: el challenge solo negocia; el resultado lo lleva el motor.)
create or replace function public.record_challenge_result(
  _challenge_id uuid, _winner_is_me boolean, _sets jsonb default '[]'::jsonb
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _c public.challenges%rowtype;
  _opp uuid;
  _mid uuid;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  select * into _c from public.challenges where id = _challenge_id for update;
  if not found then raise exception 'Reto no encontrado'; end if;
  if _uid <> _c.from_user and _uid <> _c.to_user then raise exception 'No participas en este reto'; end if;
  if _c.status <> 'accepted' then raise exception 'El reto debe estar aceptado para cargar el resultado'; end if;
  if _c.match_id is not null then return _c.match_id; end if;  -- idempotente: ya materializado

  _opp := case when _uid = _c.from_user then _c.to_user else _c.from_user end;
  -- Motor existente: crea el partido PENDING (doble confirmación mueve el rating después).
  _mid := public.record_match(_c.space_id, _c.sport, null, _opp, _winner_is_me, _sets);
  update public.challenges set match_id = _mid where id = _challenge_id;
  return _mid;
end $$;

-- 2 · Datos del badge de victoria (solo lectura). pts/XP solo existen si el partido
--     ya está confirmado (el motor los escribió); si no, vienen null/0.
create or replace function public.match_victory_card(_match_id uuid)
returns table (
  opponent_id uuid, opponent_name text, opponent_avatar_url text, opponent_avatar_kind text, opponent_avatar_look text,
  i_won boolean, confirmed boolean, sets jsonb,
  pts_delta numeric, xp_delta int, space_name text, club_name text
)
language plpgsql stable security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  m public.matches%rowtype;
  _i_am_a boolean;
  _opp uuid;
begin
  select * into m from public.matches where id = _match_id;
  if not found or not (_uid = any(m.side_a || m.side_b)) then return; end if;
  _i_am_a := _uid = any(m.side_a);
  _opp := case when _i_am_a then m.side_b[1] else m.side_a[1] end;

  return query
  select
    _opp, pf.display_name, pf.avatar_url, pf.avatar_kind, pf.avatar_look,
    case when m.match_winner = 'a' then _i_am_a else not _i_am_a end,
    (m.confirmation_status = 'confirmed'),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'me',  case when _i_am_a then ms.games_a else ms.games_b end,
               'opp', case when _i_am_a then ms.games_b else ms.games_a end) order by ms.set_index)
      from public.match_sets ms where ms.match_id = _match_id
    ), '[]'::jsonb),
    (select pl.weighted_delta from public.points_ledger pl where pl.match_id = _match_id and pl.user_id = _uid limit 1),
    (select coalesce(sum(xl.final_xp), 0)::int from public.xp_ledger xl where xl.ref_id = _match_id::text and xl.user_id = _uid),
    (select s.name from public.space s where s.id = m.space_id),
    (select c.name from public.space c where c.id = (select parent_space_id from public.space where id = m.space_id))
  from public.profiles pf where pf.id = _opp;
end $$;

grant execute on function public.record_challenge_result(uuid, boolean, jsonb) to authenticated;
grant execute on function public.match_victory_card(uuid) to authenticated;

notify pgrst, 'reload schema';
