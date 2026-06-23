# PENDIENTES — piezas formales de trabajo

> Trabajo identificado y **deliberadamente diferido**, no bugs sueltos. Cada entrada
> es una pieza acotada con alcance propio. Última actualización: 2026-06-23.

---

## 1. Vitrina de torneos del jugador/operador — PENDIENTE DE CABLEADO

**Estado:** diferida a Fase 2. No bloquea el reskin de diseño.

### Qué SÍ está construido y funciona
- El **MOTOR de torneos** completo: los **6 formatos** (eliminación simple, round robin,
  consolación, grupos→playoff, doble eliminación, americano de rotación), generación de
  cuadros, y los partidos resueltos por el motor (Glicko) con anti-farming.
- Vive en las tablas `space` (type=tournament/category), `tournament_config`,
  `tournament_bracket`, y se validó vía RPC/tests en su momento (smokes F4.1–F4.6).
- Hay datos de torneos en la base (8 torneos seed cubriendo los 6 formatos).

### Qué está STUBEADO hoy (la UI del jugador/operador)
Las pantallas de torneo cuelgan de hooks que devuelven vacío con el marcador
`// TODO: cablear fase 2`. Por eso `/torneos` aparece vacío, el detalle por slug da
"Torneo no encontrado", y el board de operador no lista nada — **independiente del seed**.

Hooks en stub (confirmados, devuelven `[]`/`null`):
- `src/hooks/useTournamentsList.ts` — lista de torneos del jugador (`/torneos`)
- `src/hooks/useTournamentDetailEnriched.ts` — detalle + inscripción (`/torneos/:slug`)
- `src/hooks/useMyOperatorTournaments.ts` — torneos donde soy operador (badge del bottom-nav)

Hooks de la misma familia que llevan el mismo marcador y deben revisarse al cablear:
- `useUserActiveTournament`, `useTournamentSessions`, `useTournamentReport`,
  `useTournamentRules`, `useTournamentOperators`, `useTournamentMembershipOffer`,
  `useTournamentGroups`, `useTournamentFinance`, `useTournamentAlert`,
  `useTournamentChallengeableOpponents`, `useTournamentCobrand`,
  `useTournamentNotifications`, `useOperatorBoard`, `useResolvedCategoryConfig`,
  `useRoundRobinStandings`, `useRoundRobinGroupStandings`, `useRoundPairs`,
  `useAmericanoRounds`, `useAmericanoIndividualStandings`.

### Alcance del cableado (cuando se haga)
1. Conectar `useTournamentsList` y `useTournamentDetailEnriched` a las tablas reales.
2. **Reconciliar el modelo de datos**: las pantallas esperan `tournament_categories`,
   `discipline`, estados (`inscripciones_abiertas`/`en_curso`/`finalizado`…) y
   `user_registration`; el seed actual modela los torneos sobre `space`/`tournament_config`
   con estados `active`/`finished` y `sport=null`. Hay que mapear uno al otro (o migrar).
3. Habilitar el flujo de **inscripción** desde la pantalla y la vista de **cuadro**.

**Es una pieza propia (varios archivos + posible migración de modelo), no un parche.**
No bloquea el reskin: las pantallas de torneo se pueden reskinear con datos de seed; el
cableado real se hace después.

---

## 2. Fichas por hito (misión/liga) — TRIGGER OK, SEED NO LO EJERCE

**Estado:** el trigger funciona; el seed no lo dispara. Mejora opcional de seed.

- Los triggers `trg_fichas_mission` (al completar misión) y `trg_fichas_promotion`
  (al ascender de liga) están bien cableados en
  `supabase/migrations/20260623130000_fichas_rpcs.sql` y otorgan Fichas
  (`grant_mission`=5, `grant_promotion`=25 en `economy_config`).
- Son `AFTER UPDATE`. El seed **inserta** misiones completas / ligas ya rankeadas sin un
  `UPDATE`, así que nunca disparan → en la demo las Fichas solo vienen del seed inicial.
- Validado en vivo (2026-06-23) forzando un UPDATE: misión→`+5 mission_complete`,
  ascenso→`+25 league_promotion`, ambos solo en `fichas_ledger` (firewall intacto).
- **Pendiente opcional:** que el seed dispare estos hitos (insert incompleto + update, o
  un `grant_fichas` directo) para que el demo muestre Fichas de hito sin pasos manuales.
