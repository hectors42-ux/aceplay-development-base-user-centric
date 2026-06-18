## Schema base: identidad global + espacios recursivos

Crear una sola migración Supabase con el schema solicitado, sin UI, sin `tenant_id`, raíz = jugador.

### Contenido de la migración

1. **Extensión** `ltree`.
2. **Tabla `profiles`** (1:1 con `auth.users`): `handle` único, `display_name`, `avatar_url`, `rut`, `birthdate`, `is_minor` (columna generada), `data_consent` jsonb, `created_at`.
3. **Enums**: `space_type`, `space_visibility`, `join_policy`, `membership_role`, `membership_status`.
4. **Tabla `space`** (recursiva con `parent_space_id` + `path ltree`), índices GIST sobre `path`, btree sobre `parent_space_id` y `type`, unique `(parent_space_id, slug)`.
5. **Trigger `space_set_path()`** que computa `path` desde el padre y valida que `category` solo cuelgue de `tournament` y nunca sea raíz.
6. **Tabla `space_membership`** (N:M jugador↔espacio) con unique `(player_id, space_id)` e índices.
7. **Tabla `space_standing`** (PK compuesta `space_id, player_id`), sin rating.
8. **RLS habilitada** en las 4 tablas (sin políticas todavía — se definen en una iteración posterior cuando definamos quién ve qué).
9. **GRANTs obligatorios** en cada tabla pública: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` y `GRANT ALL ... TO service_role` (sin `anon`, ya que todo es auth-only). Esto NO viene en el SQL que enviaste pero es requisito de la plataforma — sin GRANTs, PostgREST devuelve permission denied aunque RLS lo permita.

### Notas / preguntas implícitas resueltas por defecto

- **Sin políticas RLS** en esta migración: con RLS habilitada y sin policies, ninguna fila será accesible desde el cliente hasta que definamos políticas. Asumo que es lo deseado para esta fase (schema puro). Si quieres una policy mínima de "owner ve su profile" la agrego.
- **`space.organizer_id`** queda como `not null references profiles(id)` tal como pediste — implica que el organizador debe existir antes de crear el space (correcto para flujo "jugador crea club").
- **Memoria del proyecto desactualizada**: el repo actual (AcePlay multi-tenant con `tenants`, `ladders`, etc.) queda intacto. Esta migración suma tablas nuevas que coexisten; no toca ni borra nada existente. Si la intención es reset total del schema, dímelo y lo incluyo.

### Fuera de alcance

- Políticas RLS detalladas.
- UI / hooks / tipos cliente (se regeneran tras aprobar).
- Tablas de matches, invitaciones, rating global, etc. (futuras iteraciones).
