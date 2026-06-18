## Objetivo

Que el proyecto compile y todas las rutas rendericen sobre el nuevo backend player-first, dejando las features legacy (torneos, escalerillas, reservas, coaches, analítica) en estado vacío. Sin recablear datos reales todavía.

## Alcance

### 1. Stubificar hooks listados

Para cada hook en la lista (~60 archivos en `src/hooks/` y `src/hooks/analytics/`):

- Mantener intactos: nombre del hook, firma de parámetros, y la **forma exacta del objeto/valor retornado** (mismas keys/propiedades que hoy devuelve, incluyendo `loading`, `error`, `refetch`, etc.).
- Reemplazar el cuerpo por valores neutros:
  - arrays → `[]`
  - objetos → `null` (o `{}` si la firma exige propiedades concretas)
  - booleanos → `false`
  - `loading` → `false`, `error` → `null`
  - funciones (mutate/refetch/submit) → `async () => {}` o `() => {}` no-op
- Eliminar imports a `supabase`, a tablas inexistentes y a `@/integrations/supabase/types` que rompan TS; sustituir tipos referenciados por `any` con `// TODO: cablear fase 2 - tipar contra nuevo esquema`.
- Añadir en la primera línea del cuerpo: `// TODO: cablear fase 2`.
- No borrar archivos. No modificar componentes consumidores.

Para preservar la firma exacta, en cada hook se leerá el `return` actual y se reproducirá literal con valores vacíos (sin inventar propiedades nuevas ni quitar las existentes).

### 2. Hooks fuera de la lista que rompen build

Algunos hooks NO listados también consultan tablas eliminadas y/o son consumidos por los listados. Se inspeccionarán y, si su tipado o queries impiden compilar, se aplicará el mismo tratamiento mínimo (stub) con TODO. Candidatos probables:

- `useMatchHistory`, `useRatingHistory`, `useMyRating`, `useMyRatingWithCategory`, `useLadderNotifications`, `useUserProfileSummary`, `useViewerMembership`, `useInviteRowStates`, `useShareCardData`, `useTournamentReport`, `useLiveOverlay`, `useActiveMoment`.

Criterio: solo se tocan si bloquean `tsc`. Si compilan, se dejan tal cual.

### 3. Tipos compartidos y utilidades

Archivos como `src/lib/tournament-utils.ts`, `src/lib/ladder-utils.ts`, `src/lib/rating-utils.ts`, `src/lib/tournament-presets.ts` importan tipos de tablas que ya no existen. Se reemplazarán los tipos rotos por `any` con TODO, **manteniendo las firmas exportadas**, para no obligar a cambiar componentes.

### 4. Verificación

- `tsc --noEmit` debe pasar limpio (el agente lo corre automáticamente al guardar).
- Navegar mentalmente las rutas principales (`/`, `/compite`, `/descubrir`, `/perfil`, `/reserva`, `/torneos`, `/onboarding/*`) y confirmar que renderizan estado vacío sin throw.
- QA responsive no aplica (este paso no toca UI).

## Fuera de alcance

- No se tocan: `supabase/` (migrations, edge functions), componentes/páginas consumidores, AppShell, design tokens, motor de juego, RLS, edge functions.
- No se recablean hooks a las nuevas tablas (`space`, `space_membership`, `space_standing`, `matches`, `player_ratings`, `ladder_state`, etc.). Eso es fase 2.
- No se eliminan rutas ni features de la UI; solo se vacían sus datos.

## Detalle técnico

- Por hook se mantiene la importación de `useState`/`useEffect` solo si la firma incluye estado mutable; en la mayoría se elimina todo import salvo lo estrictamente necesario.
- Hooks que devuelven `{ data, loading, error, refetch }` quedan como:
  ```ts
  // TODO: cablear fase 2
  return { data: [] as any[], loading: false, error: null as any, refetch: async () => {} };
  ```
- Hooks que devuelven un objeto rico (p.ej. `useTournamentDetailEnriched`) reproducen la forma anterior con campos en `null`/`[]`.
- Hooks de mutación (p.ej. `useJoinOpenMatch`) devuelven `{ mutate: async () => {}, isPending: false, error: null }` o equivalente a su firma actual.
- Si un hook exporta tipos auxiliares (`export type X = ...`), se conservan pero, si dependen de `Database['public']['Tables']['xxx']`, se reemplazan por `any` con TODO.

## Resultado esperado

Compilación verde, rutas renderizando, secciones legacy mostrando estados vacíos. Base limpia para empezar fase 2 (recablear hook por hook a las nuevas tablas player-first).
