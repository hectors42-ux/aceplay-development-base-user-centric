-- RANKING GENERAL (Tanda 4 · COMMIT 2): escalafón global por deporte + modalidad,
-- a través de los 3 pools de player_ratings (tenis/singles, tenis/doubles,
-- padel/doubles — hay CHECK que prohíbe padel+singles).
--
-- FIREWALL: player_ratings tiene RLS own-rows → SECURITY DEFINER para ver a todos.
-- Expone SOLO el Nivel 0–7 (coalesce(pr.nivel, rating_to_nivel(rating))), NUNCA el
-- Glicko crudo (rating/rd) de otros. El rating solo se usa como desempate de ORDEN
-- (no se devuelve). Respeta la guarda de menores y el opt-out de ranking: quien sea
-- menor o tenga show_ranking=false queda FUERA del listado público — salvo yo mismo,
-- que siempre me veo. Las posiciones se calculan sobre el conjunto visible (∪ yo).
drop function if exists public.general_ranking(text, text);
create or replace function public.general_ranking(_sport text, _format text)
returns table (
  user_id uuid, name text, avatar_url text, avatar_kind text, avatar_look text,
  level numeric, category text, matches_played int, reliability int,
  rank_position int, is_me boolean
)
language sql stable security definer set search_path = public as $$
  with sk as (
    -- normaliza: padel solo tiene doubles (CHECK); el resto, lo pedido.
    select case when _sport = 'padel' then 'padel' else 'tennis' end as sport_key,
           case when _sport = 'padel' then 'doubles'
                when _format = 'doubles' then 'doubles' else 'singles' end as fmt
  ),
  elig as (
    select
      pr.user_id, pr.rating, pr.rd, pr.matches_count,
      coalesce(pr.nivel, public.rating_to_nivel(pr.rating)) as nivel,
      pf.display_name, pf.avatar_url, pf.avatar_kind, pf.avatar_look
    from public.player_ratings pr
    join public.profiles pf on pf.id = pr.user_id
    left join public.profile_privacy pp on pp.user_id = pr.user_id
    where pr.sport = (select sport_key from sk)
      and pr.format = (select fmt from sk)
      and (
        -- visible al público: no menor + opt-in de ranking …
        (not public.is_minor(pf) and coalesce(pp.show_ranking, true))
        -- … o soy yo (siempre me veo en mi propio ranking)
        or pr.user_id = auth.uid()
      )
  ),
  ranked as (
    select e.*,
      row_number() over (order by e.nivel desc, e.rating desc, e.display_name)::int as rank_position
    from elig e
  )
  select
    r.user_id,
    r.display_name as name,
    r.avatar_url, r.avatar_kind, r.avatar_look,
    r.nivel as level,
    (select cc.label from public.category_config cc
      where cc.sport = (select sport_key from sk)
        and cc.category_key = public.get_player_category(r.nivel, (select sport_key from sk)) limit 1) as category,
    r.matches_count as matches_played,
    greatest(0, least(100, round((350 - r.rd) / 3.0)))::int as reliability,
    r.rank_position,
    (r.user_id = auth.uid()) as is_me
  from ranked r
  order by r.rank_position;
$$;
grant execute on function public.general_ranking(text, text) to authenticated;

notify pgrst, 'reload schema';
