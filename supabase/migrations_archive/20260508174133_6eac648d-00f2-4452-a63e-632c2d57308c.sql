-- 1) Tournament status transition notifications
create or replace function public.notify_tournament_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  -- Inscripciones abiertas → avisar a suscriptores del club
  if new.status = 'inscripciones_abiertas' and old.status <> 'inscripciones_abiertas' then
    insert into public.user_notifications (tenant_id, user_id, kind, title, description, link, ref_id)
    select
      new.tenant_id,
      a.user_id,
      'tournament_open',
      'Inscripciones abiertas',
      'Ya puedes inscribirte a "' || new.name || '".',
      '/torneos/' || new.slug,
      new.id
    from public.tournament_alerts a
    where a.tenant_id = new.tenant_id
      and not exists (
        select 1 from public.user_notifications n
        where n.user_id = a.user_id
          and n.kind = 'tournament_open'
          and n.ref_id = new.id
      );
  end if;

  -- En curso → avisar a inscritos
  if new.status = 'en_curso' and old.status <> 'en_curso' then
    insert into public.user_notifications (tenant_id, user_id, kind, title, description, link, ref_id)
    select distinct
      new.tenant_id,
      uid,
      'tournament_started',
      'Tu torneo arrancó',
      '"' || new.name || '" ya está en curso. Revisa la llave.',
      '/torneos/' || new.slug,
      new.id
    from (
      select player1_user_id as uid from public.tournament_registrations
       where tournament_id = new.id and status in ('confirmada','pendiente_admin','pendiente_pareja')
      union
      select player2_user_id from public.tournament_registrations
       where tournament_id = new.id and status in ('confirmada','pendiente_admin','pendiente_pareja')
         and player2_user_id is not null
    ) s
    where uid is not null
      and not exists (
        select 1 from public.user_notifications n
        where n.user_id = uid and n.kind = 'tournament_started' and n.ref_id = new.id
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_tournament_status on public.tournaments;
create trigger trg_notify_tournament_status
after update of status on public.tournaments
for each row execute function public.notify_tournament_status_change();

-- 2) Match scheduled / rescheduled notifications
create or replace function public.notify_tournament_match_scheduled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_should_notify boolean := false;
  v_tournament record;
  v_court_name text;
  v_player_a uuid;
  v_player_a2 uuid;
  v_player_b uuid;
  v_player_b2 uuid;
  v_when_text text;
  v_link text;
begin
  if tg_op = 'INSERT' then
    v_should_notify := new.scheduled_at is not null and new.status = 'programado';
  elsif tg_op = 'UPDATE' then
    v_should_notify := new.scheduled_at is not null
      and new.status = 'programado'
      and (
        old.scheduled_at is distinct from new.scheduled_at
        or old.court_id is distinct from new.court_id
        or old.status is distinct from new.status
      );
  end if;

  if not v_should_notify then
    return new;
  end if;

  select id, name, slug into v_tournament from public.tournaments where id = new.tournament_id;
  if v_tournament.id is null then
    return new;
  end if;

  if new.court_id is not null then
    select name into v_court_name from public.courts where id = new.court_id;
  end if;

  select player1_user_id, player2_user_id into v_player_a, v_player_a2
  from public.tournament_registrations where id = new.registration_a_id;
  select player1_user_id, player2_user_id into v_player_b, v_player_b2
  from public.tournament_registrations where id = new.registration_b_id;

  v_when_text := to_char(new.scheduled_at at time zone 'America/Santiago', 'DD/MM HH24:MI');
  v_link := '/torneos/' || v_tournament.slug || '/cat/' || new.category_id;

  insert into public.user_notifications (tenant_id, user_id, kind, title, description, link, ref_id)
  select new.tenant_id, uid, 'tournament_match_scheduled',
    'Tu próximo partido',
    'Programado para ' || v_when_text || coalesce(' · ' || v_court_name, '') || ' en "' || v_tournament.name || '".',
    v_link,
    new.id
  from unnest(array[v_player_a, v_player_a2, v_player_b, v_player_b2]) as uid
  where uid is not null
    and not exists (
      select 1 from public.user_notifications n
      where n.user_id = uid
        and n.kind = 'tournament_match_scheduled'
        and n.ref_id = new.id
        and n.created_at > now() - interval '5 minutes'
    );

  return new;
end;
$$;

drop trigger if exists trg_notify_match_scheduled on public.tournament_matches;
create trigger trg_notify_match_scheduled
after insert or update on public.tournament_matches
for each row execute function public.notify_tournament_match_scheduled();