---
name: PRD 12 · Fixes finos a PRDs 1-6
description: Cierre de los gaps de PRDs 1-6 (binding ronda↔sesión, undo swap, pending card en /torneos, share triggers, ChampionCard editorial, QR inline).
type: feature
---

## Implementado (16 jun 2026)

- **§1.1 Binding ronda ↔ sesión** · `americano_rounds.tournament_session_id` (uuid → tournament_sessions, ON DELETE SET NULL, index). RPC `generate_americano_round(_category_id, _round_number, _session_id)` ahora persiste `_session_id`. Backfill por ventana horaria (created_at vs sessions.starts_at/ends_at).
- **§1.1 UI** · `AdminCategoryPairs.currentSession` se calcula desde `round.tournament_session_id` (con fallback a `sessions[0]` solo si hay 1 sesión).
- **§1.2 Chip de sesión** · `PairsRoundEditor` muestra `{name} · {HH:MM–HH:MM}` debajo del título de la ronda.
- **§2.2 Deshacer swap** · `PairsRoundEditor` mantiene `snapshotsRef` con cada estado pre-swap; botón "↺ Deshacer" junto al CTA Guardar revierte el último cambio y popea `pending`.
- **§3.2 PendingConfirmationsCard en /torneos** · El mismo componente que ya estaba en `/` se monta también arriba del listado de torneos.
- **§6.1 CelebrationOverlay epic → share** · `TournamentClosureTab` recibe `tournamentSlug` y pasa `shareUrl=/torneos/{slug}/compartir?kind=champion` al `celebrate({ kind: "epic" })`. Si Web Share existe se invoca, sino se copia.
- **§6.2 Toast post-victoria** · `ResultadoPendiente.handleConfirm` detecta `userWon` (side del user vs `winner_side`) y emite toast con action "Compartir →" hacia `?kind=moment`.
- **§6.4 ChampionCard editorial** · Nombre Cormorant italic 64px en dos líneas, Medal 56 + fila "Primer/a entre N", grid 3 columnas (+puntos, win-loss, partidos) con border-t.
- **§6.5 QR inline** · Nuevo `src/components/share/QrInline.tsx` (npm `qrcode`, dataURL PNG ECC=M, padding blanco), renderizado en esquina superior derecha de ChampionCard y DayCard.

## Marcado como YA implementado en PRDs anteriores

- §2.1 confirm en re-sortear · ya en `TournamentSummaryCard` con `AlertDialog`.
- §3.1 cron auto-confirm · migración `20260615205052` (cada minuto + `auto_confirm_after_minutes`).
- §4.1 cobrand en `TournamentCard` · `useTournamentsList` joinea `tournament_cobrand` y la card lo renderiza.
- §4.2 cobrand en `ActiveTournamentHero` · ya consume `useTournamentCobrand`.
- §6.6 `ShareSheet` filtra kinds no-elegibles · ya filtraba por `stats.is_winner` / `moment.active` / `stats.found`.

## Fuera de scope

- §3.3 Live status semántica (cosmético).
- §3.4 Countdown en RoundProgressCard (polish).
- §4.3 Email cobrand · no existe edge function de email transaccional para inscripciones.
- §4.4 Logo SVG Stade Français · pendiente entrega del cliente.
- §5 Reglamento PDF público versionado · opcional.
- §6.3 Push session-ended · depende de PRD 11 (push web).

## Archivos clave

- `src/hooks/useAmericanoRounds.ts` (añade `tournament_session_id`, `created_at`)
- `src/pages/AdminCategoryPairs.tsx`
- `src/components/tournaments/admin/PairsRoundEditor.tsx`
- `src/pages/Torneos.tsx`
- `src/pages/ResultadoPendiente.tsx`
- `src/components/tournaments/TournamentClosureTab.tsx` (+ `AdminTorneoDetalle.tsx` pasa `tournamentSlug`)
- `src/components/share/cards/ChampionCard.tsx`, `DayCard.tsx`
- `src/components/share/QrInline.tsx`
- migración `20260616_prd12_session_binding`