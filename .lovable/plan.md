## Helpers de acceso + políticas RLS

Migración única con los 3 helpers `SECURITY DEFINER` y las políticas RLS de las 4 tablas, tal cual enviaste.

### Contenido

1. **Helpers** (todos `language sql stable security definer set search_path = public`):
   - `is_member_of_space(p_space uuid) → boolean`
   - `can_access_space(p_space uuid) → boolean` — usa `path @>` (ltree), sin recursión.
   - `space_admin(p_space uuid) → boolean`

   Agrego `set search_path = public` (no estaba en tu SQL) porque el linter lo exige y `SECURITY DEFINER` sin search_path fijo es un vector de ataque. No cambia el comportamiento.

2. **Políticas RLS**:
   - `profiles`: `profiles_read` (SELECT a todos), `profiles_write` (FOR ALL solo dueño).
   - `space`: `space_read` (vía `can_access_space`), `space_insert` (organizer = auth.uid), `space_update` (organizer o `space_admin`).
   - `space_membership`: `sm_read`, `sm_join` (INSERT), `sm_manage` (UPDATE).
   - `space_standing`: `ss_read` (sin policy de escritura → solo `service_role` escribe).

### Notas

- Los helpers son `SECURITY DEFINER` → bypassan RLS al consultar `space` y `space_membership` desde dentro de las policies. No hay recursión infinita.
- **Sobre los errores TS pendientes**: son del código viejo de AcePlay (NotificationCenter, PartnerPicker, hooks de ladders/tournaments, etc.) que referencia tablas borradas. Esta migración no los toca. Siguen rotos hasta que decidas borrar `src/` o construir nueva UI. Si quieres, en el próximo turno limpio `src/` a un stub mínimo para destrabar la build — fuera del alcance de este prompt.

### Fuera de alcance

- Limpieza de UI rota.
- Más tablas / RPCs de dominio.
