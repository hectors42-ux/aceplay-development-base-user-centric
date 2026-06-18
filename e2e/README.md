# Suite E2E Playwright — `qa-sandbox`

Tests de navegador que recorren los 8 flujos críticos sobre el mundo sembrado
por `qa_seed_all()`. **No** se ejecutan desde Lovable; corren en local o CI.

## ⚠️ Reglas duras

- Solo corre contra el tenant `qa-sandbox`. `globalSetup` aborta si la env
  `QA_TENANT_SLUG` no es exactamente `qa-sandbox`.
- **NO** apuntar a producción ni a un tenant real.
- Los usuarios QA (`qa_admin`, `qa_org`, `qa_org2`, `qa_player_a`,
  `qa_player_b`) ya existen — sus credenciales se pasan por `.env.e2e`.

## Setup

```bash
cp .env.e2e.example .env.e2e
# completar SUPABASE_SERVICE_ROLE_KEY y las QA_*_EMAIL/PASSWORD
npm run e2e:install
```

## Correr

```bash
npm run e2e            # headless, todos los flujos
npm run e2e:ui         # modo UI interactivo
npx playwright test e2e/specs/e2e-03-ciclo-escalerilla.spec.ts
```

`globalSetup` ejecuta `qa_reset('qa-sandbox')` + `qa_seed_all()` antes de la
suite, así que cada corrida parte del mismo estado conocido.

## Flujos

| # | Spec | Qué valida |
|---|---|---|
| 1 | crear-evento-herencia | preset escalerilla heredado, pádel fuerza dobles |
| 2 | permiso-organizador | qa_org2 no entra a la consola de qa_org |
| 3 | ciclo-escalerilla | desafío → 3 slots → confirmación → resultado → tabla |
| 4 | correccion-resultado | advertencia de partidos dependientes |
| 5 | grupos-playoff | bracket de 8 generado al avanzar grupos |
| 6 | scoring-invalido | rechaza set 3 sin súper-TB |
| 7 | cierre-deadline | status finalizado + podio + ediciones bloqueadas |
| 8 | historial-reputacion | /mis-torneos muestra campeón y métricas reales |

## Notas de implementación

- `fullyParallel: false`, `workers: 1`: los flujos comparten un mismo tenant
  sembrado y algunos dependen del estado dejado por el anterior (E2E-8 lee
  el cierre de E2E-7).
- Si un selector resulta frágil (toca innerText/regex), agregar `data-testid`
  en el componente y simplificar el spec en un follow-up.
- T-PRD7 (validación de scoring puro) se cubre en `src/test/*` con vitest;
  no se duplica acá.