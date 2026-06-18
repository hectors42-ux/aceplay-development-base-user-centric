---
name: PRD 8 · Overlay de streaming
description: Ruta pública /live/:slug con layouts standings/now_playing/lower_third para OBS Browser Source, RPCs públicas sanitizadas y botón Destacar en operador
type: feature
---

## Ruta
- `GET /live/:slug` — pública, lazy en `App.tsx`, fuera de `ProtectedRoute` y de `AppShell`. 404 minimal si `tournaments.is_public_stream_enabled = false`.
- Query `?layout=standings|now_playing|lower_third|bracket` (default standings).
- Canvas 1920×1080 (lower_third 1920×270 con `background: transparent`). El componente fuerza `body.background = transparent` cuando es lower_third.

## Backend
- Flag `tournaments.is_public_stream_enabled boolean default false`.
- Tabla `tournament_stream_featured (tournament_id PK, match_id, set_at, set_by)` con RLS para managers + operadores y realtime.
- RPCs `SECURITY DEFINER` con GRANT a `anon, authenticated`:
  - `get_public_stream_tournament(_slug)` — meta + cobrand sanitizado.
  - `get_public_stream_standings(_slug, _limit)` — top N (display_name, initials, points) desde `standings_snapshots` más reciente por categoría.
  - `get_public_stream_now_playing(_slug)` — featured match o fallback al último `en_curso`. Nombres como `Nombre A.`, nada de handles ni ratings.

## Frontend
- Hooks `useLiveTournament`, `useLiveStandings`, `useLiveNowPlaying` (con realtime subs scoped).
- Componentes en `src/components/overlay/`: `StandingsOverlay` (FLIP con framer-motion `layout`), `NowPlayingOverlay` (marcador 220px), `LowerThirdOverlay` (rotador 8s), `BracketOverlay` (placeholder), `OverlayClock`, `LiveBadge`.
- `usePrefersReducedMotion` desactiva FLIP, pulse de LiveBadge y rotación del lower_third.
- Admin: tab Co-marca tiene switch + `StreamUrlsCard` con copy-to-clipboard.
- Operador: `CourtLiveCard` muestra botón "Destacar en stream" cuando el flag está activo y el partido está `en_juego`.

## Deuda
- Bracket layout es placeholder (épica aparte cuando el cliente lo necesite).
- Featured es uno por torneo; no hay selector por categoría.
- No hay transiciones entre layouts ni control remoto del overlay.
- Test E2E del overlay sin auth pendiente.