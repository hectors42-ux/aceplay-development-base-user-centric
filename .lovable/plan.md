## Objetivo

Crear un torneo **Pádel Americano · Stade Français** según el documento adjunto y sembrar **5 escenarios** distintos (uno por estado del ciclo de vida) para validar visualmente todos los flujos del motor `grupos_playoff` en la app, con `demouser@aceplay.cl` participando como jugador.

## Especificación del torneo (según docx)

- **Formato**: fase de grupos + eliminación directa estilo Mundial
- **Modalidad**: pádel dobles (20 parejas / 40 jugadores)
- **Grupos**: 4 grupos x 5 parejas (round-robin interno)
- **Clasificación**: top 2 de cada grupo → cuartos → semis → final
- **Scoring**: set único con punto de oro (40-40 sin ventaja)
- **Calendario**: 4 días (D1 grupos parte 1 · D2 grupos parte 2 · D3 cuartos+semis · D4 final)
- **Sede**: Stade Français (se guarda en `description` + `default_config`)
- **demouser@aceplay.cl** + **hectors42@gmail.com** entran como pareja en el Grupo A para que `/mis-torneos` y `/perfil` muestren contenido real

## Escenarios a sembrar

Se crean 5 torneos paralelos, cada uno fija el estado del ciclo en un punto distinto para que el QA recorra todas las pantallas:

| # | Torneo | Estado UI | Qué se valida |
|---|--------|-----------|---------------|
| 1 | `[Demo] Americano · Inscripciones` | `inscripciones_abiertas` | listado público, registro, dialog inscripción |
| 2 | `[Demo] Americano · Día 1` | `en_curso`, grupos 50% jugados | tarjetas de grupo en progreso, standings parciales, partidos pendientes |
| 3 | `[Demo] Americano · Día 2` | `en_curso`, grupos 100%, playoff sin generar | botón "generar playoff", standings finales por grupo, top 2 destacados |
| 4 | `[Demo] Americano · Día 3` | `en_curso`, cuartos jugados, semis 50% | bracket en vivo, OperatorLiveBoard, RoundProgressCard |
| 5 | `[Demo] Americano · Finalizado` | `finalizado`, campeón decidido | resultado final, share-cards, informe post-torneo, badges |

## Implementación técnica

### 1. Migración SQL nueva

`_demo_seed_padel_grupos_playoff(_label text, _state text) RETURNS uuid` (SECURITY DEFINER, copia el patrón de `_demo_seed_tournament` pero hardcodeando):

- `sport='padel'`, `modality='dobles'`, `discipline='padel_dobles'`, `motor='grupos_playoff'`, `surface='arcilla'`
- 40 jugadores (demouser + hector + 38 bots `demo-bot-%`) → 20 inscripciones doubles
- `INSERT INTO tournament_rules`: `scoring_profile='set_unico_punto_oro'`, `notes` con calendario 4 días
- `INSERT INTO tournament_sessions` con 4 sesiones (D1..D4) fechadas en `[hoy-3, hoy+1]`
- `default_config = {demo_protocol:'v1', protocol_label, venue:'Stade Français', spec:'americano-grupos-playoff'}`
- Llama `generate_groups(cat_id, 4, seeds)` (snake seeding, demouser+hector como cabeza de grupo A)
- Avanza la simulación según `_state`:
  - `dia1`: marca jugados ~50% de los partidos de grupos (random scores con `_demo_random_score`)
  - `dia2`: 100% grupos jugados, NO genera bracket de playoff
  - `dia3`: genera bracket (RPC existente del motor `grupos_playoff`), juega cuartos completos, ~50% semis
  - `finalizado`: juega todo + `tournaments.status='finalizado'`, `closed_at=now()`

### 2. Wrapper público

`demo_seed_padel_americano_protocolo() RETURNS jsonb` (SECURITY DEFINER, gated a `club_admin`/`super_admin` como el resto del protocolo demo):

- Borra torneos previos cuyo `default_config->>'spec' = 'americano-grupos-playoff'`
- Llama 5 veces al helper con los labels y estados de la tabla
- Devuelve resumen `{tournaments:[{label,state,id,...}], errors:[]}`

### 3. UI · `src/pages/admin/AdminDemoProtocol.tsx`

Añadir una nueva Card **"Pádel Americano · 5 escenarios"** con un botón `Sembrar` que llama al wrapper. Lista los 5 torneos sembrados con link a `/admin/torneos/:id` y `/torneos/:id`. Sin tocar el botón `Ejecutar protocolo` existente (queda intacto).

### 4. QA visual (responsive 375/768/1280)

Tras sembrar:
1. Login como `demouser@aceplay.cl` → `/torneos` (debe ver los 5), `/mis-torneos` (debe verse inscrito), `/perfil` (badges/historial poblado en el finalizado)
2. Login admin → `/admin/torneos/:id` para cada uno → verificar grupos, standings, bracket, OperatorLiveBoard
3. Captura Playwright de cada escenario en mobile + desktop antes de cerrar

## Archivos a tocar

- `supabase/migrations/<ts>_demo_padel_americano_protocolo.sql` (nuevo) — helper + wrapper RPC
- `src/pages/admin/AdminDemoProtocol.tsx` — nueva Card + botón
- `mem/features/roadmap.md` — registrar la feature de QA seed

## Riesgos / notas

- Si la RPC de generación de playoff de `grupos_playoff` requiere flujo distinto al del seed actual, lo verifico antes de escribir la migración (no se llama hoy desde `_demo_seed_tournament`, solo `generate_groups`).
- `tournament_sessions` puede tener triggers que validen ventana → si falla, se omiten y se documenta.
- No se modifica el motor ni el scoring real, solo se siembra.

## Entregables

- 5 torneos visibles en preview con `demouser` inscrito
- Documentación inline del calendario y la sede en cada torneo
- Botón reproducible en `/admin/protocolo-pruebas` para resembrar cuando se necesite
