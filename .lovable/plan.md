## Motor Spec v2 — migración única

Crear las 9 tablas exactamente como están en el spec, sin modificar forma. Único añadido ya incluido: `matches.space_id`. Todo `user_id` referencia `profiles(id)` global. Rating, puntos y XP quedan en tablas separadas (sin mezcla).

### Tablas a crear
1. `category_config` (PK compuesta `sport, rank_order`)
2. `matches` (+ índices `space_id`, `played_at`) — con `space_id → space(id)`
3. `match_sets` (PK `match_id, set_index`)
4. `player_ratings` (PK `user_id, sport, format`, check anti padel-singles)
5. `rating_history` (bigserial)
6. `ladder_state` (PK `user_id, sport, format`)
7. `points_ledger` (bigserial)
8. `xp_ledger` (bigserial)
9. `league_state` (PK `user_id, week`)

### RLS
- Enable RLS en `matches`, `player_ratings`, `ladder_state` (resto queda sin RLS por ahora, tal como el spec).
- `matches_read`: `can_access_space(space_id) OR auth.uid() = ANY(side_a||side_b)` — portabilidad del jugador.
- `ratings_read`: `user_id = auth.uid()`.
- `ladder_read`: `user_id = auth.uid()`.

### Añadidos obligatorios (no alteran forma del spec)
- `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated` y `GRANT ALL … TO service_role` en las 9 tablas (sin esto PostgREST devuelve 401/permission denied; no modifica el schema, solo permisos del Data API).
- No se añaden políticas de write — quedará bloqueado vía RLS en las 3 tablas con RLS activa (el motor escribirá con `service_role`, consistente con el patrón ya usado en `space_standing`).

### Lo que NO se hace
- No se tocan `club_profile`, `tournament_config`, `escalerilla_config`, `space`, `space_membership`, `space_standing`, `profiles`.
- No se crean triggers, funciones extra, ni se enforce `space.type` para `source_type` (queda a nivel motor).
- No se modifica código frontend (sigue stub).

### Validación post-migración
- Correr linter de seguridad y reportar warnings nuevos.
- Confirmar 9 tablas + 3 RLS + 3 policies + 2 índices.

¿Procedo en build mode?
