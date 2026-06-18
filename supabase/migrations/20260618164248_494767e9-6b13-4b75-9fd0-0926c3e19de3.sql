alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists bio text,
  add column if not exists dominant_hand text check (dominant_hand in ('right','left','ambi')),
  add column if not exists backhand text check (backhand in ('one_handed','two_handed')),
  add column if not exists favorite_shot text,
  add column if not exists favorite_surface text check (favorite_surface in ('arcilla','cesped','dura','sintetico')),
  add column if not exists playing_style text,
  add column if not exists years_playing int,
  add column if not exists phone text,
  add column if not exists show_email boolean not null default false,
  add column if not exists show_phone boolean not null default false;

create or replace function public.get_player_category(_nivel numeric, _sport text default 'tennis')
returns text language sql stable set search_path = public as $$
  select category_key from public.category_config
  where sport = _sport
    and rank_order = least(greatest(round(_nivel)::int,1),
        (select max(rank_order) from public.category_config where sport=_sport))
  limit 1
$$;