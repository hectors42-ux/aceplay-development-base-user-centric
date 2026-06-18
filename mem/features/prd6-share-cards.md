---
name: PRD 6 · Share cards WOW
description: 5 variantes de share cards brandeadas (champion, moment, standings, day, profile) capturadas a PNG con html-to-image. Sheet desde el header del torneo y página dedicada /torneos/:slug/compartir. Watermark obligatorio + cobrand (PRD 4).
type: feature
---

## Estado
MVP entregado (Fase A–E completas, Fase F QA inicial pendiente).

## Backend
- `get_share_card_stats(_tournament_id, _user_id)` → JSON con rank, points, wins/losses, total_players, consecutive_wins, is_winner, user.
- `get_active_share_moment(_tournament_id, _user_id)` → `{active, kind: 'streak'|'climb', value, rank, delta}` o `{active:false}`. Threshold: cw ≥ 3 o delta ≥ 3 posiciones.
- `get_share_standings(_tournament_id, _category_id?, _limit=12)` → top N desde `standings_snapshots` (latest per user).
- Migración: `20260616_share_cards`. Functions `security definer`. Execute granted a `authenticated` y `anon` (standings es público).

## Frontend
- `<ShareCard kind format ref>` selecciona variante. 5 cards en `src/components/share/cards/*`.
- `ShareCardFrame` aplica gradient cobrand, eyebrow lockup + bandera, watermark inferior (`@handle` + `aceplay × {cobrand} · {host}/torneos/{slug}`).
- Captura: `useShareCardCapture(ref).{download, shareNative}` → html-to-image `toPng` con `pixelRatio: 2`. Dim lógicas 540×960 (story) y 540×540 (square) → captura 1080×1920 / 1080×1080.
- Action bar: WhatsApp (Web Share API con archivo, fallback `wa.me`), Historia (descarga story PNG), `⋯` (copiar link, descargar 1:1, 9:16).
- Sheet `ShareSheet` se abre desde el icono share del header de `TorneoDetalle`. Solo lista kinds aplicables (champion solo si winner, moment solo si activo, etc.).
- Página `/torneos/:slug/compartir?kind=&userId=` (lazy en App.tsx). Gating de elegibilidad por kind.
- Realtime: `useShareStandings` subscribe a `standings_snapshots`; `useActiveMoment` a `tournament_registrations`.

## Analytics
- `share_card_opened {kind, tournament_id}`
- `share_card_downloaded {kind, format}`
- `share_card_shared {kind, channel: native|whatsapp}`
- Vía `trackEvent` (batched, sin nuevo schema — usa `analytics_events`).

## No incluido en MVP
- QR en cards champion/day (TODO).
- Snapshot público sin auth en `/compartir` (sigue dentro de ProtectedRoute por simplicidad; standings sí puede ser anon-callable a nivel RPC).
- Toast post-resultado con CTA "Compartir este momento" (gancho desde ScoreboardEditor pendiente).
- CelebrationOverlay no se cambió — quien lo invoca debe pasar `shareUrl = /torneos/:slug/compartir?kind=champion`.
- Auto-disparo de la card `day` al cerrar última ronda agendada.

## Reglas
- Toda card lleva watermark `WatermarkFooter` — no eliminar.
- No usar emojis 🥇 — `<Medal place>` SVG gold/silver/bronze.
- Cobrand gradient siempre sobre `gradient_css` del tenant; fallback al clay-deep oficial.
- Reduced-motion: no animar entrada del preview en SharePage (animar solo el pulse del pill "en vivo", aceptable).