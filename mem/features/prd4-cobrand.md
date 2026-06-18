---
name: PRD 4 · Co-marca de torneo (sponsor)
description: tournament_cobrand, useTournamentCobrand, CobrandHero/Badge/Footer, tab Co-marca admin
type: feature
---

`public.tournament_cobrand` (PK = `tournament_id`, FK CASCADE): brand_key, display_name, eyebrow_text, lockup_text, flag_country, logo_url (URL pública, no upload), rights_text, primary_hex, accent_hex, gradient_css. Realtime activo. SELECT público; INSERT/UPDATE/DELETE solo `is_tournament_manager`.

Hook: `useTournamentCobrand(tournamentId)` con realtime sobre cambios del registro. Para listados, embed PostgREST `tournament_cobrand(display_name, flag_country, lockup_text, primary_hex)` evita N+1.

Componentes en `src/components/tournaments/cobrand/`:
- `<Flag countryCode size>` — SVG inline, NO emoji (fr/cl/ar/es/it; fallback gris).
- `<CobrandHero cobrand>` — wrapper para hero del torneo cuando hay cobrand.
- `<CobrandBadge cobrand variant>` — pill o lockup, reusable en cards.
- `<CobrandFooter cobrand>` — watermark para share cards (PRD 6).

Admin: tab "Co-marca" en `AdminTorneoDetalle` (grid md:grid-cols-8). Form con preset selector, color pickers (gradient se genera automáticamente con `buildGradient` 155° primary→mix→accent), warning AA contra blanco si `contrastRatio < 4.5`, URL de logo (no upload — `public_buckets_blocked`), textarea de rights con `sanitizePlain` (strip HTML). Preview en vivo con `<CobrandHero>`.

Aplicado en: `TorneoDetalle.tsx` (background del hero + eyebrow lockup), `TournamentCard.tsx` (badge), `ActiveTournamentHero.tsx` (badge).

Helpers: `cobrand-registry.ts` exporta `COBRAND_REGISTRY` (stade_francais, pro_trainer), `buildGradient`, `contrastRatio`, `sanitizePlain`.

NO se creó bucket `tournament-logos` — público bloqueado por workspace. Solución: logo como URL pública. Si más adelante se habilitan public buckets, crear bucket + policies por path `{tournament_id}/...`.
