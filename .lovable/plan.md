## Seed determinístico v1 — `seed/demo.sql` (idempotente)

Una sola migración (sin código frontend). Estrategia: **DELETE por slug/handle → INSERT** + `on conflict do nothing/update` como red de seguridad. UUIDs derivados de `md5(slug)::uuid` para que cada re-run produzca exactamente los mismos IDs y los FKs cuadren entre corridas.

### 1. `category_config` — semilla canónica §11.2
Tal cual el bloque que mandaste (12 filas, `on conflict (sport, rank_order) do update`). Tenis 1-5, padel 1-7.

### 2. Espacio demo (idempotente)

**Slugs estables** (base de los UUIDs vía `md5`):
- club: `demo-club` → path `demo_club`
- tournament: `torneo-apertura` (parent club) → path `demo_club.torneo_apertura`
- category: `cuarta` (parent tournament) → path `demo_club.torneo_apertura.cuarta`
- escalerilla: `escalerilla` (parent club) → path `demo_club.escalerilla`

**Configs 1:1:**
- `club_profile`: `legal_name='Club Demo'`, `branding='{}'`, sin tax_id.
- `tournament_config`: `disciplina='tennis'`, `motor='round_robin'`, `scoring='best_of_3'`, `prestige_mult=1.0`.
- `escalerilla_config`: `season_label='T1'`, `pyramid='{}'`, `challenge_rules='{}'`.

**Profiles demo (16):** handles `demo01`..`demo16`, display_name `Demo 01`..`Demo 16`, UUIDs vía `md5('demo-profile-'||handle)::uuid`. Sin `auth.users` real (los seeds no autentican). `data_consent='{}'`.

**`space_membership`:**
- Los 16 en el club (`role='player'`, `status='active'`). `demo01` además es `owner` del club y `organizer_id` de los 4 spaces.
- Primeros 8 (`demo01`..`demo08`) miembros de la categoría.
- Últimos 8 (`demo09`..`demo16`) miembros de la escalerilla.

### 3. Orden de borrado (cascade hace el resto)
```sql
delete from space_membership where player_id in (select id from profiles where handle like 'demo%');
delete from space where slug in ('demo-club','torneo-apertura','cuarta','escalerilla')
  and (path::text like 'demo_club%' or slug='demo-club');
-- club_profile / tournament_config / escalerilla_config caen por FK on delete cascade
delete from profiles where handle like 'demo%';
```

### 4. Forma de ejecución
- Va por **migration tool** (cambios deterministas; no usa `auth.uid()`).
- Re-correr la migration produce el mismo estado final (UUIDs estables, deletes previos).

### Asunciones que conviene confirmar antes de codear
1. **Deporte del torneo y la escalerilla:** asumo `tennis` para ambos. ¿OK o uno de los dos en padel?
2. **Motor del torneo:** asumo `round_robin`. ¿Prefieres `grupos_playoff` o `americano`?
3. **`profiles.id` sin FK a `auth.users`:** el schema actual no la tiene, así que los 16 demos son "shadow profiles" (no podrán loguearse, solo sirven para QA visual). ¿Confirmas o quieres que también cree usuarios reales en `auth` vía edge function?
4. **Visibilidad de los spaces:** asumo `members` para club/torneo/categoría/escalerilla. ¿O quieres el club `public` para que se vea sin login?

Dime las 4 respuestas (o "todo OK con los defaults") y emito la migration.
