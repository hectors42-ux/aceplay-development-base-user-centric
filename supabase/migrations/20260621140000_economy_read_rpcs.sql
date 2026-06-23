-- Read RPCs para los hooks de la capa de enganche (solo lectura, por sport_id).
-- No tocan el motor: leen exclusivamente las tablas de XP/liga/racha/misión.

create or replace function public.my_xp(_sport_id text)
returns table (xp_total integer, xp_week integer)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(final_xp), 0)::int,
         coalesce(sum(final_xp) filter (where created_at >= date_trunc('week', now())), 0)::int
  from public.xp_ledger
  where user_id = auth.uid() and sport_id = _sport_id;
$$;

create or replace function public.my_league(_sport_id text)
returns table (league_id uuid, tier integer, user_id uuid, name text, xp_week integer, rank integer, is_me boolean)
language sql stable security definer set search_path = public as $$
  with myl as (
    select l.id, l.tier
    from public.leagues l
    join public.league_members lm on lm.league_id = l.id and lm.user_id = auth.uid()
    where l.sport_id = _sport_id and l.status = 'active'
    limit 1
  )
  select myl.id, myl.tier, lm.user_id, pf.display_name,
         lm.xp_week, (rank() over (order by lm.xp_week desc))::int, lm.user_id = auth.uid()
  from myl
  join public.league_members lm on lm.league_id = myl.id
  join public.profiles pf on pf.id = lm.user_id
  order by lm.xp_week desc;
$$;

create or replace function public.my_streak(_sport_id text)
returns table (current_weeks integer, longest_weeks integer, freezes_available integer)
language sql stable security definer set search_path = public as $$
  select coalesce(s.current_weeks, 0), coalesce(s.longest_weeks, 0), coalesce(s.freezes_available, 0)
  from (select 1) one
  left join public.streaks s on s.user_id = auth.uid() and s.sport_id = _sport_id;
$$;

create or replace function public.my_missions()
returns table (code text, title text, target integer, progress integer, reward_xp integer, completed boolean)
language sql stable security definer set search_path = public as $$
  select m.code, m.title, m.target, coalesce(mp.progress, 0), m.reward_xp, mp.completed_at is not null
  from public.missions m
  left join public.mission_progress mp on mp.mission_id = m.id and mp.user_id = auth.uid()
  where m.active = true
  order by m.code;
$$;

grant execute on function public.my_xp(text) to authenticated;
grant execute on function public.my_league(text) to authenticated;
grant execute on function public.my_streak(text) to authenticated;
grant execute on function public.my_missions() to authenticated;

notify pgrst, 'reload schema';
