-- ============================================================================
-- RPCs + triggers de la capa de Premio. FIREWALL: grant_fichas y redeem_ficha
-- NUNCA tocan player_ratings/rating_history ni xp_ledger; no hay conversión
-- Fichas<->XP. Los triggers de hito otorgan un monto FIJO de economy_config
-- (jamás derivado del XP) → recompensa explícita y unidireccional.
-- ============================================================================

-- Código de canje único.
create or replace function public._gen_redemption_code()
returns text language plpgsql security definer set search_path = public as $$
declare _code text; _i int;
begin
  for _i in 1 .. 10 loop
    _code := 'ACE-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    if not exists (select 1 from public.redemptions where code = _code) then return _code; end if;
  end loop;
  return 'ACE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
end $$;

-- Otorgar Fichas (recompensa de hito). Idempotente por ref. Definer; NO se
-- concede a authenticated (los usuarios no acuñan sus propias Fichas).
create or replace function public.grant_fichas(_user_id uuid, _amount int, _reason text, _ref_type text default null, _ref_id text default null)
returns int language plpgsql security definer set search_path = public as $$
declare _cfg jsonb; _exp int;
begin
  if _user_id is null or _amount is null or _amount <= 0 then return 0; end if;
  if _ref_id is not null and exists (
    select 1 from public.fichas_ledger
    where user_id = _user_id and reason = _reason and ref_type is not distinct from _ref_type
      and ref_id = _ref_id and delta > 0
  ) then return 0; end if;
  select value into _cfg from public.economy_config where key = 'fichas';
  _exp := coalesce((_cfg->>'expiry_days')::int, 90);
  insert into public.fichas_ledger (user_id, delta, reason, ref_type, ref_id, expires_at)
  values (_user_id, _amount, _reason, _ref_type, _ref_id, now() + (_exp || ' days')::interval);
  return _amount;
end $$;

-- Canjear una Ficha por un premio: atómico y a prueba de doble-canje.
create or replace function public.redeem_ficha(_reward_item_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _item public.reward_items%rowtype; _bal int; _code text; _rid uuid; _ex public.redemptions%rowtype;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  -- Serializa canjes concurrentes del mismo usuario+item (anti doble-clic).
  perform pg_advisory_xact_lock(hashtextextended(_uid::text || _reward_item_id::text, 0));
  -- Dedup de doble-clic accidental: mismo user+item en los últimos 6s → mismo código, sin descontar de nuevo.
  select * into _ex from public.redemptions
    where user_id = _uid and reward_item_id = _reward_item_id and created_at > now() - interval '6 seconds'
    order by created_at desc limit 1;
  if found then return jsonb_build_object('code', _ex.code, 'redemption_id', _ex.id, 'deduplicated', true); end if;

  select * into _item from public.reward_items where id = _reward_item_id for update;
  if not found or not _item.active then raise exception 'Premio no disponible'; end if;
  if _item.stock is not null and _item.stock <= 0 then raise exception 'Sin stock'; end if;

  select coalesce(sum(delta), 0) into _bal from public.fichas_ledger
    where user_id = _uid and (expires_at is null or expires_at > now());
  if _bal < _item.cost_fichas then raise exception 'No te alcanzan las Fichas'; end if;

  _code := public._gen_redemption_code();
  insert into public.fichas_ledger (user_id, delta, reason, ref_type, ref_id)
    values (_uid, -_item.cost_fichas, 'redeem', 'reward_item', _reward_item_id::text);
  if _item.stock is not null then
    update public.reward_items set stock = stock - 1 where id = _reward_item_id;
  end if;
  insert into public.redemptions (user_id, reward_item_id, code, status)
    values (_uid, _reward_item_id, _code, 'issued') returning id into _rid;
  -- El redemption ES el lead (user+item+code+fecha) para el take-rate comercial.
  return jsonb_build_object('code', _code, 'redemption_id', _rid, 'deduplicated', false);
end $$;

-- Lecturas para los hooks.
create or replace function public.my_fichas()
returns table (balance int, expiring_amount int, expiring_at timestamptz)
language sql stable security definer set search_path = public as $$
  with cfg as (select coalesce((value->>'expiring_soon_days')::int, 14) d from public.economy_config where key = 'fichas'),
  live as (select delta, expires_at from public.fichas_ledger
           where user_id = auth.uid() and (expires_at is null or expires_at > now()))
  select coalesce(sum(delta), 0)::int,
    coalesce(sum(delta) filter (where delta > 0 and expires_at is not null
      and expires_at < now() + ((select d from cfg) || ' days')::interval), 0)::int,
    min(expires_at) filter (where delta > 0 and expires_at is not null
      and expires_at < now() + ((select d from cfg) || ' days')::interval)
  from live;
$$;

create or replace function public.list_rewards()
returns table (id uuid, brand_id uuid, brand_name text, brand_slug text, title text, benefit_label text, cost_fichas int, stock int, sport_scope text)
language sql stable security definer set search_path = public as $$
  select ri.id, b.id, b.name, b.slug, ri.title, ri.benefit_label, ri.cost_fichas, ri.stock, ri.sport_scope
  from public.reward_items ri join public.brands b on b.id = ri.brand_id
  where ri.active and b.active
  order by b.name, ri.cost_fichas;
$$;

create or replace function public.reward_detail(_id uuid)
returns table (id uuid, brand_name text, brand_slug text, title text, benefit_label text, cost_fichas int, stock int, terms text, sport_scope text, active boolean)
language sql stable security definer set search_path = public as $$
  select ri.id, b.name, b.slug, ri.title, ri.benefit_label, ri.cost_fichas, ri.stock, ri.terms, ri.sport_scope, ri.active
  from public.reward_items ri join public.brands b on b.id = ri.brand_id
  where ri.id = _id;
$$;

create or replace function public.my_redemptions()
returns table (id uuid, code text, status text, created_at timestamptz, used_at timestamptz, title text, benefit_label text, brand_name text)
language sql stable security definer set search_path = public as $$
  select r.id, r.code, r.status, r.created_at, r.used_at, ri.title, ri.benefit_label, b.name
  from public.redemptions r
  join public.reward_items ri on ri.id = r.reward_item_id
  join public.brands b on b.id = ri.brand_id
  where r.user_id = auth.uid()
  order by r.created_at desc;
$$;

-- ----------------------------------------------------------------------------
-- Triggers de HITO → Fichas (monto fijo de config; NUNCA lee XP). Explícito y
-- unidireccional: "completar misión" / "ascender de liga" otorga Fichas.
-- ----------------------------------------------------------------------------
create or replace function public._grant_fichas_on_mission_complete()
returns trigger language plpgsql security definer set search_path = public as $$
declare _amt int;
begin
  if new.completed_at is not null and old.completed_at is null then
    select coalesce((value->>'grant_mission')::int, 5) into _amt from public.economy_config where key = 'fichas';
    perform public.grant_fichas(new.user_id, _amt, 'mission_complete', 'mission', new.mission_id::text);
  end if;
  return new;
end $$;

drop trigger if exists trg_fichas_mission on public.mission_progress;
create trigger trg_fichas_mission after update of completed_at on public.mission_progress
  for each row execute function public._grant_fichas_on_mission_complete();

create or replace function public._grant_fichas_on_promotion()
returns trigger language plpgsql security definer set search_path = public as $$
declare _amt int;
begin
  if new.movement = 'promoted' and (old.movement is distinct from 'promoted') then
    select coalesce((value->>'grant_promotion')::int, 25) into _amt from public.economy_config where key = 'fichas';
    perform public.grant_fichas(new.user_id, _amt, 'league_promotion', 'league', new.league_id::text);
  end if;
  return new;
end $$;

drop trigger if exists trg_fichas_promotion on public.league_members;
create trigger trg_fichas_promotion after update of movement on public.league_members
  for each row execute function public._grant_fichas_on_promotion();

-- Permisos: los usuarios canjean y leen; NO acuñan Fichas (grant_fichas es interno).
grant execute on function public.redeem_ficha(uuid) to authenticated;
grant execute on function public.my_fichas() to authenticated;
grant execute on function public.list_rewards() to authenticated;
grant execute on function public.reward_detail(uuid) to authenticated;
grant execute on function public.my_redemptions() to authenticated;

notify pgrst, 'reload schema';
