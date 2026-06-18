# Suite pgTAP — Torneos AcePlay

Verifica el contrato del dominio de torneos sobre el mundo sintético de
`qa_seed_all()`. Todos los tests operan **exclusivamente** sobre el tenant
`qa-sandbox`; jamás contra clubes reales.

## Cómo correrla

```bash
# Local (CLI de Supabase)
supabase test db

# o con pg_prove directamente
pg_prove -d "$DATABASE_URL" supabase/tests/*.sql
```

Cada archivo abre su propia transacción (`BEGIN; … ROLLBACK;`) y carga
`setup.sql`, que ejecuta `qa_reset('qa-sandbox') + qa_seed_all()`. Así
la suite es re-ejecutable sin estado residual.

## Archivos

| Archivo | PRD | Cobertura |
|---|---|---|
| `00_invariantes_globales.sql` | — | invariantes que deben cumplirse SIEMPRE |
| `01_prd0_cimientos.sql`       | PRD0 | constraints, aislamiento por categoría |
| `02_prd1_permisos.sql`        | PRD1 | roles, `is_tournament_manager`, RLS |
| `03_prd2_wizard_herencia.sql` | PRD2 | scoring heredado, presets independientes |
| `04_prd3_observacion.sql`     | PRD3 | `match_observation_outbox` + idempotencia |
| `06_prd6_round_robin.sql`     | PRD6 | RR + `round_robin_standings` + `chk_challenge_target` |
| `08_prd8_grupos_playoff.sql`  | PRD8 | `generate_groups` + bloqueo de avance incompleto |
| `09_prd9_cierre_cuota_dominante.sql` | PRD9 | `evaluate_dominant_rule`, `toggle_registration_fee` |
| `10_prd10_americano.sql`      | PRD10 | rotación, standings individual, observación dobles |
| `11_prd11_consolacion_doble.sql` | PRD11 | brackets multi-cuadro |

## T-PRD7 (scoring)

`validateScore`, `matchWinner` y `countGames` viven en TypeScript
(`src/lib/scoring/*`). Se testean con **vitest** en
`src/test/scoring-profile.test.ts`. No se duplican en pgTAP para no
divergir de la implementación productiva.

## Convenciones

- `\i supabase/tests/setup.sql` al inicio de cada archivo.
- `SELECT plan(N)` declara el número exacto de aserciones.
- Caminos de fallo usan `throws_like` / `throws_ok`.
- Mutaciones temporales viven dentro del bloque `BEGIN; … ROLLBACK;`
  para no contaminar el seed.
- `_qa_impersonate(uuid)` simula `auth.uid()`.

## Out of scope

- Integración con CI (documentación del comando es suficiente; un workflow
  externo decide cuándo correrla).
- Cambios en frontend para consumir las vistas nuevas (iteración aparte).

## Requisitos de ejecución

- La suite **debe** correrse como `postgres` o `service_role` (lo que hace
  `supabase test db` por defecto). Los archivos que mutan datos
  (`03_prd2_*`, `06_prd6_*`, `09_prd9_*`) tocan tablas con RLS activa y
  fallan con _permission denied_ si se ejecutan como `authenticated` o
  `sandbox_exec`.
- pgTAP (`pgtap`) debe estar instalado; `setup.sql` hace
  `CREATE EXTENSION IF NOT EXISTS pgtap`.