-- FASE 5 (Part A): minimal CORE-wired creation of escalerillas and tournaments, with a
-- first-class `visibility` toggle (members / hierarchy / public). No tenant_id, no old model.
-- Creation is gated to club organizers/admins (membership role owner/admin/organizer in a club).

-- Which club (if any) the caller organizes. Drives the "Crear" affordance + creation target.
create or replace function public.my_organizer_club()
returns uuid language sql stable security definer set search_path = public as $$
  select m.space_id
  from public.space_membership m
  join public.space s on s.id = m.space_id and s.type = 'club'
  where m.player_id = auth.uid() and m.status = 'active' and m.role in ('owner', 'admin', 'organizer')
  order by m.joined_at
  limit 1;
$$;

-- Helper: a safe ltree label + slug from a free-text name (+ random suffix for uniqueness).
create or replace function public._slugify(_name text, _fallback text)
returns text language sql immutable as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(_name), '[^a-z0-9]+', '-', 'g')), ''), _fallback);
$$;

create or replace function public.create_escalerilla(_name text, _sport text, _visibility text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _club uuid; _cpath public.ltree; _seg text; _suf text; _slug text; _id uuid;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  if _visibility not in ('public', 'members', 'hierarchy') then raise exception 'Visibilidad inválida'; end if;
  if _sport not in ('tennis', 'padel') then raise exception 'Deporte inválido'; end if;
  if coalesce(trim(_name), '') = '' then raise exception 'El nombre es obligatorio'; end if;
  _club := public.my_organizer_club();
  if _club is null then raise exception 'Necesitas perfil de organizador o admin de un club para crear'; end if;

  select path into _cpath from public.space where id = _club;
  _suf := substr(md5(random()::text), 1, 6);
  _seg := coalesce(nullif(trim(both '_' from regexp_replace(lower(_name), '[^a-z0-9]+', '_', 'g')), ''), 'esc');
  _slug := public._slugify(_name, 'escalerilla') || '-' || _suf;

  insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status, settings)
  values ('escalerilla', _club, _cpath || (_seg || '_' || _suf)::public.ltree, _name, _slug,
          _visibility::public.space_visibility, 'request', _sport, _uid, 'active', jsonb_build_object('created_via', 'ui'))
  returning id into _id;

  insert into public.escalerilla_config (space_id, pyramid, challenge_rules, season_label)
  values (_id, '{}', '{}', null);
  return _id;
end $$;

create or replace function public.create_tournament(_name text, _sport text, _visibility text, _motor text, _category_label text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _club uuid; _cpath public.ltree; _tpath public.ltree;
        _seg text; _suf text; _slug text; _tid uuid; _cid uuid; _vis public.space_visibility; _cat text;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  if _visibility not in ('public', 'members', 'hierarchy') then raise exception 'Visibilidad inválida'; end if;
  if _sport not in ('tennis', 'padel') then raise exception 'Deporte inválido'; end if;
  if _motor not in ('single_elimination','round_robin','consolation','groups_playoff','double_elimination','americano')
    then raise exception 'Motor inválido'; end if;
  if coalesce(trim(_name), '') = '' then raise exception 'El nombre es obligatorio'; end if;
  _club := public.my_organizer_club();
  if _club is null then raise exception 'Necesitas perfil de organizador o admin de un club para crear'; end if;

  _cat := coalesce(nullif(trim(_category_label), ''), 'Categoría OPEN');
  _vis := _visibility::public.space_visibility;
  select path into _cpath from public.space where id = _club;
  _suf := substr(md5(random()::text), 1, 6);
  _seg := coalesce(nullif(trim(both '_' from regexp_replace(lower(_name), '[^a-z0-9]+', '_', 'g')), ''), 'torneo');
  _slug := public._slugify(_name, 'torneo') || '-' || _suf;
  _tpath := _cpath || (_seg || '_' || _suf)::public.ltree;

  insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status, settings)
  values ('tournament', _club, _tpath, _name, _slug, _vis, 'request', null, _uid, 'active', jsonb_build_object('created_via', 'ui'))
  returning id into _tid;
  insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
  values (_tid, _motor, 'manual', _sport, 'best_of_3', 'puntual', 1.0);

  insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status, settings)
  values ('category', _tid, _tpath || ('cat_' || _suf)::public.ltree, _cat, _slug || '-cat', _vis, 'request', _sport, _uid, 'active', '{}'::jsonb)
  returning id into _cid;
  insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
  values (_cid, _motor, 'manual', _sport, 'best_of_3', 'puntual', 1.0);

  return _tid;
end $$;

grant execute on function public.my_organizer_club() to authenticated;
grant execute on function public.create_escalerilla(text, text, text) to authenticated;
grant execute on function public.create_tournament(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
