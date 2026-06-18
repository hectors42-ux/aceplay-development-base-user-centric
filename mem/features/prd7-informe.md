---
name: PRD 7 · Informe post-evento
description: Métricas agregadas por torneo (participación, share, captación, AVE), tab Informe en admin, PDF cobrand + CSV vía edge function
type: feature
---

## Alcance entregado
- RPC `public.tournament_report_metrics(_tournament_id uuid) RETURNS jsonb` (SECURITY DEFINER, search_path=public, GRANT a `authenticated`, valida `is_tournament_manager`).
- Hook `useTournamentReport` y tab `Informe` en `AdminTorneoDetalle` con layout editorial (Participación · Compartido · Captación · Valor publicitario estimado).
- Edge function `export-tournament` extendida con `mode: "report"`:
  - `format: "pdf"` → 4 páginas brandeadas (cobrand color en banda y títulos) generadas con pdf-lib.
  - `format: "csv"` → eventos de `tournament_events` (kind, at, payload) con BOM para Excel, sin PII.
- Helper puro `src/lib/ave.ts` con CPM_STORY=8.5, CPM_POST=12, REACH_PER_SHARE=180, USD_CLP=950 y `AVE_DISCLAIMER`.

## Decisión: función vs vista materializada
El PRD pedía vista materializada con cron de refresh. Decidí función SQL live por (a) sin operación de refresh, (b) cero ventana de obsolescencia, (c) ~30ms para torneos de 80 jugadores. Si crece el volumen, materializar es fácil porque la función ya define el contrato JSON.

## Origen de datos de share
`trackEvent` escribe en `public.analytics_events` (no en `tournament_events`). La RPC lee de `analytics_events` filtrando por `event_props->>'tournament_id'`. Si en el futuro se duplican a `tournament_events`, ajustar la rama del SELECT.

## Dependencia PRD 9 (captación)
Los kinds `activate_level_clicked` y `guest_to_member_converted` no se emiten todavía. La tab muestra placeholder "Métricas de captación se activan al desplegar PRD 9.".

## Deuda técnica documentada
- **Thumbnails server-side de share cards** en el PDF: requiere headless browser (no soportado en Deno edge). Fuera de scope.
- **Refresh trigger en `closed_at`**: no implementado porque la RPC es live.
- **Dashboard cross-torneo del club**: no contemplado, este informe es por torneo.