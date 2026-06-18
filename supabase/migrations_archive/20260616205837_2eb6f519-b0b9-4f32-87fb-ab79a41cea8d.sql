create or replace function public.auto_confirm_pending_results()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with affected as (
    update tournament_matches m
       set confirmation_status = 'jugado',
           confirmed_at = now(),
           confirmed_by = null
      from tournaments t
     where m.tournament_id = t.id
       and m.confirmation_status = 'pendiente_confirmacion'
       and m.reported_at < now()
           - make_interval(mins => coalesce(t.auto_confirm_after_minutes, 10))
    returning m.id, m.tournament_id, t.tenant_id
  )
  insert into tournament_events (tournament_id, tenant_id, kind, payload)
  select tournament_id, tenant_id, 'auto_confirmed',
         jsonb_build_object('match_id', id)
    from affected;

  get diagnostics v_count = row_count;
  return v_count;
end$$;

select cron.schedule(
  'auto_confirm_pending_results',
  '* * * * *',
  $$ select public.auto_confirm_pending_results(); $$
);