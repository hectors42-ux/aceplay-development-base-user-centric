# PENDIENTES — piezas formales de trabajo

> Trabajo identificado y **deliberadamente diferido**, no bugs sueltos. Cada entrada
> es una pieza acotada con alcance propio. Última actualización: 2026-06-24
> (cierre de la Épica M · Cancha).

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

> **Relación con la Épica M (Cancha):** la **agenda** de Cancha (`get_match_agenda`) arranca
> SOLO con challenges aceptados + retos de escalera (Addendum B). Cuando se cablee esta vitrina,
> los partidos de torneo se **suman de forma ADITIVA** (un `UNION ALL` más) — ya queda el marcador
> `// TODO: sumar partidos de torneo al cablear la vitrina` en `get_match_agenda`, sin reestructurar.

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

---

## 3. Homologación de diseño — COMPLETADA salvo 2 elementos bloqueados por dato

**Estado:** ✅ **COMPLETADA.** La fase de reskin/diseño se cierra el 2026-06-24. La
homologación visual a `docs/design/` está hecha en todas las pantallas, **salvo 2 elementos
que necesitan datos que hoy NO existen** (no son reskin; se cablean en Fase 2).

### Lo que SÍ quedó homologado (cerrado)
- Sistema Arena: CoinHud doble moneda, insignia `.arena` con anillo volt, botones oro en
  Tienda, cabecera de Perfil, Liquid Glass por tema, FAB naranja. Commits `7e2ae73`…`33fcee5`.
- Marca: Rally en favicon + PWA (`name` "AcePlay", fondo navy), Brand Foundation en
  `docs/design/brand-foundation/`, wordmark Cormorant (Ace roman · Play italic). Commit `ba50474`.
- HUD con identidad (avatar + nombre), selector de deporte centrado, footer de marca
  compartido (`AppFooter`: arco + AcePlay · Tennis, gamified · año · derechos, sin club) en
  Inicio y Perfil, rediseño de la vista de Auth (splash con arco animado + Rally) y tour de
  bienvenida reescrito a la app actual. Commits `dc9efef`, `f24f693`.

### Los 2 elementos bloqueados por dato (Fase 2, no reskin)
- **"Desafío del día" de Inicio** (rival sugerido + "+30 PTS" + head-to-head, como en
  `docs/design/reference/inicio.png`): `src/hooks/useMatchOfTheWeek.ts` es **stub**
  (`items: []`), así que `MatchOfTheWeekCard` no renderiza. Hace falta un RPC/hook que
  proponga un oponente del nivel del jugador (relacionado: `useSuggestedMatchup`,
  `useChallengeablePlayers`, también stub). Hasta entonces, el home omite esa tarjeta.
- **"PRESENTA [Marca]" por evento en Descubrir** (`descubrir.png`): el RPC
  `discover_opportunities` no devuelve la marca/sponsor por oportunidad ni un flag
  "destacado". Para el lockup por evento y el tag DESTACADO hay que extender el RPC.
  El lockup general (`SponsorLockup scope="discover"`) y los tags Abierto/En vivo sí están.

---

## 4. Tienda y Espacios — RESKIN PARCIAL (dependencia de cableado, no bug)

**Estado:** la **presentación** está homologada al sistema Arena, pero ambas pantallas
muestran **datos vacíos** porque cuelgan de hooks en **stub**. No es un bug del reskin: es
una **dependencia** del cableado de la estructura competitiva / vitrina de torneos.

- **Tienda:** la grilla, los botones oro y el HUD de Fichas están reskineados. El catálogo
  real de canjes depende de los datos de Fichas/beneficios que aún no se exponen por completo.
- **Espacios:** la pantalla y la navegación (5º destino) están reskineadas, pero el listado
  de torneos/categorías queda vacío por los hooks en stub descritos en el **punto 1**
  (`useTournamentsList`, `useTournamentDetailEnriched`, `useMyOperatorTournaments`, etc.).

**Cuándo se completa:** al cablear la **vitrina de torneos / estructura competitiva** (punto 1).
Hasta entonces se quedan en reskin parcial **por diseño**, no por defecto pendiente.

---

## 5. Fondo del tema Arena — DECIDIDO: NAVY `#070B16`

**Estado:** ✅ **DECIDIDO y cerrado** (2026-06-24). Cierra la antigua "decisión de fondo
navy vs cálido".

- El fondo por defecto del tema Arena es **navy `#070B16`**, alineado al token `--bg` del CSS
  de diseño (`docs/design/tokens/aceplay-arena.css`). Se mantiene el principio "tokens manda".
- Se descarta el fondo cálido (naranja) que insinuaban las referencias PNG
  (`docs/design/reference/*.png`); esas referencias se interpretan como ambientación, no como
  superficie. Decisión confirmada por el cliente.
- Coherente con el **sistema estacional K** (Cemento navy-azul / Arcilla cálido / Pasto verde /
  Arena navy): no se solapa Arena con Arcilla.

---

## 6. Épica M · Cancha — ✅ COMPLETADA (M1–M5)

**Estado:** ✅ **COMPLETADA** (2026-06-24). La sección "Cancha" (vida competitiva + conexión:
el reemplazo del grupo de WhatsApp) se montó **SOBRE el motor existente sin tocarlo**. Cero
`tenant_id`. Firewall de 3 cruces **probado en vivo de punta a punta**.

### Lo entregado, por pieza
- **M1 · datos + RPCs** (`20260628120000`…`160000`): tablas `availability_calls`, `challenges`
  (solo negocia slots), `profile_privacy` (reusa `is_minor`); RPCs `suggest_partners`,
  `post/take_availability`, `send/respond_challenge`, `compute_ascension_path` (camino de
  ascenso, solo lectura), `get_public_profile`, `get_match_agenda`, `availability_feed`,
  `flag_results_pending` (estado "vencido" derivado **on-read**, sin cron). Firewall vitest.
- **M2 · hub `/cancha`** (3 tabs Progreso/Subir/Conexión) + FAB → /cancha (absorbe `/ranking`,
  que redirige) + notificaciones del Inicio (reto recibido · carga tu resultado · llamado).
- **M3 · conexión visible**: `/cancha/buscar` (Zona, match% + "por qué", empate→más cercano),
  `/jugador/:id` (perfil público), `/cancha/reto/:toId` (enviar reto · lugar + slots).
- **M4 · llamados abiertos**: `/cancha/disponibilidad` (lanzar) + `/cancha/llamados` (feed en
  vivo, "Tomar" first-come atómico). **Carrera multi-usuario probada** (solo el primero gana).
- **M5 · cierre del loop**: `/invitaciones`, `/agenda`, `/resultado/cargar/:matchId`
  (`record_challenge_result` reusa `record_match`), `/victoria/:matchId` (badge compartible,
  sin precios). **Loop validado en vivo:** el rating se movió **solo tras la doble confirmación**.

### Guardas cumplidas (verificadas en vivo)
- **Firewall de 3 cruces:** ninguna RPC de conexión (sugerir/publicar/tomar/retar/agendar)
  escribe en rating/xp/fichas; el premio sigue **solo** en el flujo de resultado (motor +
  anti-farming). El badge es presentación, no otorga nada.
- **Protección de menores (Ley 21.719 · Addendum D), en BACKEND** (reusa `is_minor`, una sola
  fuente de verdad): un menor no aparece en matchmaking, no expone datos en el perfil público,
  **no publica disponibilidad** (`post_availability` rechaza) y **nunca** aparece en el feed.

Commits `35b51f1` (M1) · `d2fdd1e` (M2) · `8ff2a17` (M3) · `2a08b1f` (M4) · `05db9e8` (fix
menores) · `f951d0f`/`5d91315` (M5).

---

## 7. Épica K · temas estacionales — DIFERIDA (guinda final)

**Estado:** diferida como **última guinda**, después de cerrar todo lo competitivo (Cancha ✅).

- Temas de superficie por temporada (Cemento navy-azul / Arcilla cálido / Pasto verde / Arena
  navy) + modo estacional automático por calendario. Es **acabado visual**, no núcleo: no
  bloquea ninguna función. Coherente con la decisión de fondo navy (punto 5).
- Se retoma cuando se decida cerrar el pulido visual estacional; sin dependencias con Cancha.
