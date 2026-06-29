-- Reglamento de torneo (cablea la sección "Reglas", antes stub). Tabla versionada
-- + RLS (lectura abierta a usuarios; escritura del organizador). Publica el
-- reglamento del gemelo de Providencia. Sin montos en pesos (material interno).
create table if not exists public.tournament_rules (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.space(id) on delete cascade,
  version int not null default 1,
  is_current boolean not null default true,
  descriptive_md text,
  format_table_json jsonb,
  key_rules_md text,
  tiebreak_rules_md text,
  player_guide_md text,
  operator_guide_md text,
  image_rights_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tournament_rules_current_idx on public.tournament_rules (tournament_id) where is_current;
grant select on public.tournament_rules to authenticated;
grant all on public.tournament_rules to service_role;
alter table public.tournament_rules enable row level security;
do $$ begin
  create policy tr_read on public.tournament_rules for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy tr_write on public.tournament_rules for all
    using (public.space_can_manage(tournament_id)) with check (public.space_can_manage(tournament_id));
exception when duplicate_object then null; end $$;

-- Publicar el reglamento del torneo RR de Providencia.
do $$
declare _t uuid;
begin
  select id into _t from public.space where slug = 'rr-providencia-2026' and type = 'tournament';
  if _t is null then return; end if;
  if exists (select 1 from public.tournament_rules where tournament_id = _t) then return; end if;
  insert into public.tournament_rules (tournament_id, version, is_current, descriptive_md, format_table_json, key_rules_md, tiebreak_rules_md, player_guide_md)
  values (
    _t, 1, true,
    'Campeonato pensado para fomentar la competencia, la regularidad y, por sobre todo, la camaradería. Se disputa bajo **Round Robin** (todos contra todos): cada victoria cuenta y cada juego suma para la clasificación final. Los desafíos quedan a criterio de cada jugador — hay un universo suficiente de rivales para desafiar de principio a fin del período.',
    '[{"key":"Modalidad","value":"Round Robin · todos contra todos"},{"key":"Partidos","value":"2 sets con tie-break + súper tie-break a 10 en el 3°"},{"key":"Agenda","value":"Desafío libre entre jugadores"},{"key":"Pelotas","value":"A acuerdo de los contrincantes"},{"key":"Cierre","value":"29 de noviembre 2026"},{"key":"Sede","value":"Club de Tenis Providencia (o acuerdo mutuo)"}]'::jsonb,
    E'### Regla del Jugador Dominante\nPara premiar la dominancia y evitar que partidos prácticamente definidos queden inconclusos por el tiempo de cancha. Se aplica solo si, al interrumpir, se cumplen **a la vez**:\n\n- El Jugador A ganó el 1er set.\n- A lidera el 2do set.\n- A suma **10 o más** juegos (set 1 + set 2).\n- B ganó **menos del 50%** de los juegos totales de su rival.\n\n**Acción:** se da por ganador a A. Al ganador se le suman los juegos para llegar a 6 en el 2do set; al perdedor, la mitad (redondeo hacia arriba). Ejemplo: 6-1, 4-1 → 6-1, 6-2.\n\n### Partidos inconclusos\nSi se interrumpe y no aplica la regla anterior: se retoma respetando el marcador exacto, en un plazo máximo de 2 semanas. Los **retiros** se ponderan por los sets y juegos jugados, sumando al menos un partido ganado al vencedor.',
    E'### Jerarquía de clasificación\n1. **Partidos ganados** (ponderación 1.0)\n2. **Sets ganados** (0.1)\n3. **Juegos ganados** (0.01)\n4. **Puntos de súper tie-break** (0.001)\n5. **Duelo directo** entre los jugadores empatados\n\n### Premios y cierre\n- Premios para los **4 primeros** de la tabla general.\n- **Asado de cierre**: los **últimos 6** de la tabla financian la carne y complementos; las bebidas, cada asistente por su cuenta.',
    E'1. **Desafía** a quien quieras de la tabla — mientras más juegas, más puntos acumulas al cierre.\n2. **Acuerda** pelota, día y cancha con tu rival (prioridad: Club de Tenis Providencia).\n3. **Juega** a 2 sets + súper tie-break en el tercero.\n4. **Carga el resultado** con el organizador para que sume a la tabla ponderada.'
  );
end $$;

notify pgrst, 'reload schema';
