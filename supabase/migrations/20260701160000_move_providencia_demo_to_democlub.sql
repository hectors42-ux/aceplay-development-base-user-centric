-- LIMPIEZA · Club Providencia: hoy cuelgan de él datos de PRUEBA (una escalerilla
-- de tenis + un torneo round-robin "Escalerilla Providencia" con su categoría).
-- Se mueven al "AcePlay Demo Club" y se renombran para que quede claro que son
-- datos DEMO, sin relación con Providencia. Providencia queda limpio para una
-- carga futura de datos reales.
--
-- Solo se reparenta/renombra en `space`. Todo lo demás (membresías, standings,
-- matches, roster, brackets, tournament_config) está keyeado por space_id/category_id
-- — los ids NO cambian, así que la data viaja con su espacio sin orfandad.
--
-- El trigger trg_space_path recomputa `path` SOLO en la fila tocada (no cascada):
-- por eso se mueve el torneo ANTES y luego se re-toca la categoría para que tome
-- el path nuevo del torneo. Idempotente: si ya están bajo el demo, no hace nada.
do $$
declare
  _demo uuid; _prov uuid;
  _esc uuid; _tour uuid; _cat uuid;
begin
  select id into _demo from public.space where slug = 'demo-club' and type = 'club';
  select id into _prov from public.space where slug = 'club-providencia' and type = 'club';
  if _demo is null or _prov is null then
    raise notice 'demo-club o club-providencia no existen; nada que mover';
    return;
  end if;

  -- Solo lo que AÚN cuelga de Providencia (idempotencia: tras mover, ya no estarán).
  select id into _esc  from public.space where parent_space_id = _prov and type = 'escalerilla' and slug = 'escalerilla-providencia';
  select id into _tour from public.space where parent_space_id = _prov and type = 'tournament'  and slug = 'torneo-escalerilla-prov';

  -- 1 · Escalerilla de tenis → demo, con nombre/slug demo-claros.
  if _esc is not null then
    update public.space
       set parent_space_id = _demo,
           name = 'Escalerilla Demo · Tenis',
           slug = 'escalerilla-tenis-demo'
     where id = _esc;
    raise notice 'escalerilla movida a demo (%).', _esc;
  end if;

  -- 2 · Torneo round-robin (se llamaba "Escalerilla Providencia") → demo.
  if _tour is not null then
    update public.space
       set parent_space_id = _demo,
           name = 'Torneo Demo · Round Robin (Tenis)',
           slug = 'torneo-rr-tenis-demo'
     where id = _tour;
    raise notice 'torneo RR movido a demo (%).', _tour;

    -- 3 · Su categoría: el parent (torneo) ya tiene path nuevo; re-tocamos el slug
    -- para que el trigger recompute el path bajo demo_club.*.
    select id into _cat from public.space where parent_space_id = _tour and type = 'category';
    if _cat is not null then
      update public.space
         set slug = 'cat-rr-tenis-demo',
             name = 'Grupo único · Demo'
       where id = _cat;
      raise notice 'categoría repatheada (%).', _cat;
    end if;
  end if;

  -- Verificación: Providencia debe quedar sin hijos.
  if exists (select 1 from public.space where parent_space_id = _prov) then
    raise notice 'AVISO: Providencia aún tiene hijos tras la limpieza.';
  else
    raise notice 'Providencia limpio (sin competencias).';
  end if;
end $$;

notify pgrst, 'reload schema';
