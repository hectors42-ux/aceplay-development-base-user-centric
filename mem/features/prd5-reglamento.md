---
name: PRD 5 · Reglamento de torneos
description: Tabla tournament_rules con versionado, RulesTab admin, RulesView player, HowItWorks landing y PDF cobrandeado.
type: feature
---

## Modelo
- tournament_rules (uno por torneo, is_current unico parcial). Campos: descriptive_md, format_table_json (array {key,value}), key_rules_md, tiebreak_rules_md, player_guide_md, operator_guide_md, image_rights_md, version, created_by.
- RPC publish_tournament_rules(_tournament_id, _payload jsonb) SECURITY DEFINER: marca anterior is_current=false e inserta nueva version atomicamente. Requiere is_tournament_manager.
- RLS: SELECT publico; INSERT/UPDATE/DELETE solo manager del torneo.
- tournament_registrations extendida con rules_version_accepted INT, rules_accepted_at TIMESTAMPTZ.

## Frontend
- useTournamentRules(tournamentId) -> { rules, loading, saveDraft, publish }.
- RULE_TEMPLATES en src/lib/tournament-rule-templates.ts: americana_social, grupos_playoff, eliminacion_simple.
- RulesMarkdown (markdown-it + DOMPurify, allowlist p/ul/ol/li/strong/em/h2-4/a/code/blockquote/br/hr).
- parsePlayerSteps(md) parsea "1. **Titulo**\n   Descripcion".
- Admin: tab "Reglamento" en AdminTorneoDetalle.tsx (grid-cols-9). Editor 6 secciones + tabla formato + preview live sticky en lg+.
- Player: tab "Reglas" en TorneoDetalle.tsx (grid-cols-4). RulesView con eyebrow, titulo italic, tabla mono, secciones, guia colapsable, descarga PDF.
- Landing: HowItWorks antes del CTA Inscribirme si existe player_guide_md.
- RegisterDialog: checkbox aceptar reglamento + UPDATE rules_version_accepted post-RPC.

## PDF
- supabase/functions/export-tournament acepta mode=rules. No requiere admin. Branded con cobrand. Portada A4, secciones, footer.
