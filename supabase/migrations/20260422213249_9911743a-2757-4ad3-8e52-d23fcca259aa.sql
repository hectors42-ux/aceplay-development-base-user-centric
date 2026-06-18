-- Archivar el documento antiguo "¿Cómo se calcula mi nivel?"
UPDATE public.legal_documents
SET is_active = false, updated_at = now()
WHERE id = '13035246-504b-4590-8f8a-7628bc0fe400';

-- Nuevo documento: Ranking y Pirámide (reemplaza al anterior, kind=rating_explained)
INSERT INTO public.legal_documents (kind, title, version, content_md, is_active, tenant_id, effective_at)
VALUES (
  'rating_explained',
  'Ranking y pirámide del club',
  '2.0',
  $MD$# Ranking y pirámide del club

Esta guía explica cómo funciona el **ranking del club**, el sistema de **pirámide (ladder)** y cómo participar y hacer seguimiento de tu progreso.

## 1. ¿Qué es el ranking?

El ranking ordena a todos los socios según su **nivel de juego (rating)** calculado automáticamente a partir de los partidos oficiales que juegas en el club: torneos, desafíos de pirámide y clases competitivas.

- A mejor nivel, **mejor posición** en el ranking.
- El ranking se separa por modalidad: **singles** y **dobles**.
- Cada jugador tiene además una **categoría** (A, B, C…) según su nivel y confiabilidad.

## 2. ¿Cómo se calcula mi nivel?

Tu nivel es un número entre **1.0 y 7.0** (escala estilo NTRP) que sube o baja después de cada partido oficial.

### Factores que influyen

- **Resultado del partido**: ganar suma puntos, perder los resta.
- **Diferencia de nivel con el rival**: ganarle a alguien mejor suma más; perder contra alguien peor resta más.
- **Confiabilidad (reliability)**: indica qué tan precisas son las estimaciones de tu nivel. Sube con cada partido jugado y baja con la inactividad. A mayor confiabilidad, los cambios son más pequeños y precisos.
- **Tipo de partido**: torneos y desafíos de pirámide tienen mayor peso que partidos amistosos.

### Test inicial

Cuando te registras, completas un **test inicial de nivel** que te ubica en una posición razonable de partida. A partir de ahí, cada partido va ajustando tu rating real.

### Inactividad

Si dejas de jugar partidos oficiales por un tiempo prolongado, tu **confiabilidad baja gradualmente** (no tu nivel directamente). Esto significa que tus próximos partidos pesarán más para reajustar el rating cuando vuelvas.

## 3. Categorías del club

Según tu nivel y confiabilidad mínima, el sistema te asigna una categoría:

- **Categoría A**: jugadores avanzados.
- **Categoría B**: nivel intermedio.
- **Categoría C**: nivel inicial / en desarrollo.

Las categorías se usan para inscripciones a torneos por nivel y para emparejar pirámides.

## 4. La pirámide (ladder)

La pirámide es una **competencia continua** entre socios donde puedes desafiar a jugadores mejor posicionados que tú. Si ganas, **subes en la pirámide**.

### Cómo participar

1. Entra a la sección **Pirámide** desde el menú principal.
2. Si la pirámide está abierta a inscripciones, presiona **Unirme**.
3. Comenzarás en la última posición disponible.

### Cómo desafiar

- Solo puedes desafiar a jugadores con **mejor posición que tú** (número menor).
- El salto máximo está limitado por el **rango configurado** (por ejemplo, hasta 3 posiciones arriba).
- Cada jugador tiene un **cooldown** entre desafíos contra el mismo rival.

### Aceptar y jugar

- El desafiado tiene una **ventana de respuesta** (en horas) para aceptar o rechazar.
- Una vez aceptado, ambos coordinan fecha, hora y cancha desde el dialog del desafío.
- Tienen una **ventana de juego** (días) para disputar el partido. Si se vence, el desafío expira.

### Resultado

- Si gana el desafiante: **toma la posición** del desafiado y este baja.
- Si gana el desafiado: mantiene su posición y el desafiante regresa a la suya.
- Si alguien no se presenta: cuenta como **walkover** a favor del rival.

### Inactividad en la pirámide

Si pasas demasiado tiempo sin jugar desafíos, puedes **bajar automáticamente** de posición según las reglas de inactividad de la pirámide.

## 5. Hacer seguimiento de tu progreso

Desde la app puedes seguir tu evolución en distintos lugares:

- **Inicio** → tu tarjeta de jugador muestra nivel, categoría, rachas y posición.
- **Ranking** → ordenamiento completo del club, con podio y subida/bajada de posiciones.
- **Mi perfil** → historial completo de cambios de nivel (subes, bajas, motivo) y gráfica de evolución.
- **Pirámide** → tu posición actual, desafíos activos, historial y rivales sugeridos.
- **Notificaciones** → te avisamos cuando cambia tu nivel, recibes un desafío o se acerca una fecha de partido.

## 6. Insignias y logros

A medida que juegas, ganas **insignias** por hitos: primer partido, racha de victorias, número de torneos jugados, ascensos, etc. Las puedes ver en **Mi perfil → Logros completos**.

## 7. Buenas prácticas

- **Juega con frecuencia**: mantiene alta tu confiabilidad y evita decay por inactividad.
- **Acepta desafíos a tiempo**: respetar las ventanas evita conflictos y walkovers.
- **Confirma resultados con honestidad**: el sistema depende de los marcadores reportados.
- **Si no puedes asistir, avisa**: comunícate con tu rival o usa la cancelación dentro de plazo.

## 8. Preguntas frecuentes

**¿Por qué bajé de nivel si gané mi último partido?**
Puede que el ajuste sea mínimo si tu rival era de menor nivel; o que tu confiabilidad haya hecho que un partido anterior pese más en el recálculo.

**¿Puedo desafiar al número 1?**
Solo si está dentro del salto máximo permitido por la pirámide.

**¿Qué pasa si me lesiono?**
Cancela los desafíos pendientes o coordina con tu rival un walkover. Tu nivel no baja por inactividad inmediata.
$MD$,
  true,
  NULL,
  now()
);

-- Nuevo documento: Manual de torneos
INSERT INTO public.legal_documents (kind, title, version, content_md, is_active, tenant_id, effective_at)
VALUES (
  'club_regulation',
  'Manual de torneos del club',
  '1.0',
  $MD$# Manual de torneos del club

Guía completa para **crear, participar y hacer seguimiento** de torneos en la app del club.

## 1. ¿Qué es un torneo?

Un torneo es una competencia organizada por el club con **fechas, canchas dedicadas y un cuadro (llave)** que enfrenta a los participantes hasta llegar a un campeón. Los torneos pueden tener varias **categorías** (singles A, dobles B, etc.), cada una con su propia llave.

## 2. Para socios: cómo participar

### 2.1. Inscribirse

1. Entra a **Torneos** desde el menú principal.
2. Elige el torneo y la **categoría** que coincida con tu nivel y modalidad (singles/dobles).
3. Presiona **Inscribirme** dentro del periodo de inscripción.
4. Si es **dobles**, selecciona a tu compañero/a desde el buscador.
5. Espera la confirmación del organizador.

> Las inscripciones se cierran en la fecha límite o cuando se llena el cupo. Algunos torneos tienen lista de espera.

### 2.2. Esperar el sorteo (seeding)

El administrador genera la **llave** y asigna automáticamente día, hora y cancha a tu primer partido dentro de la **ventana del torneo**.

### 2.3. Aceptar tu partido

Cuando el partido queda programado, recibirás una **notificación** y verás un badge ámbar **"Programado · esperando aceptación"**.

- Entra al detalle del torneo y abre tu partido.
- Pulsa **Aceptar** si te acomoda la fecha/cancha asignada.
- Cuando ambos jugadores aceptan, el partido pasa a **"Confirmado"** (badge verde).

### 2.4. Solicitar un cambio (una sola vez)

Si la fecha/cancha asignada no te acomoda:

1. En el partido, presiona **Solicitar cambio**.
2. Verás una **lista de huecos disponibles** (solo dentro de las canchas dedicadas y la ventana de la fase).
3. Elige uno y envía la propuesta.
4. Tu rival recibe la propuesta y puede **aceptar o rechazar**.

> Solo tienes **una solicitud aceptada por partido**. Si se acepta, el botón "Solicitar cambio" desaparece. Si tu rival la rechaza, no consume el cupo y puedes proponer otra opción.

### 2.5. Jugar y reportar resultado

- Llega a tiempo a la cancha asignada.
- Al terminar, **uno de los jugadores propone el resultado** desde la app.
- El rival lo **confirma o rechaza**.
- Una vez confirmado, el partido queda registrado y se actualiza la llave.

> **Walkover**: si tu rival no se presenta dentro del tiempo de tolerancia, puedes reportar walkover a tu favor.
> **Retiro por lesión**: el resultado se registra como "retirado" y avanza el rival.

### 2.6. Hacer seguimiento

- **Llave**: vista del bracket completo, con cancha y hora de cada partido.
- **Filtro "En curso ahora"**: resalta los partidos jugándose en este momento con un badge **EN VIVO**.
- **Detalle de partido**: muestra jugadores, ranking, cancha, hora y estado.
- **Notificaciones**: te avisan de partidos programados, cambios solicitados y resultados.

## 3. Para todos los socios: ver torneos en curso

Aunque no participes, puedes seguir el torneo desde la app:

- **Vista pública del torneo** muestra el bracket con todos los enfrentamientos.
- Cada tarjeta de partido muestra **cancha, hora y estado** (programado / en juego / jugado).
- Los partidos en vivo aparecen con un **indicador animado**.
- En la sección **Reservar**, los slots ocupados por torneo aparecen con un **badge naranja** "Torneo · {nombre}" — no son reservables, pero al pasar el cursor ves los detalles del partido.

## 4. Para administradores: cómo crear y gestionar un torneo

### 4.1. Crear el torneo

1. Entra a **Mi perfil → Administrar torneos → Nuevo torneo**.
2. Completa los datos básicos:
   - Nombre y descripción.
   - **Fechas de inscripción** y **fechas del torneo**.
   - Modalidad principal (singles/dobles) y superficie.
3. **Asigna canchas dedicadas**: selecciona las canchas del club que se reservarán para el torneo. Solo en estas se podrán programar y reagendar partidos.
4. Define la **ventana horaria diaria** (ej. 18:00–22:00 entre semana, 09:00–20:00 fin de semana).

### 4.2. Definir las fases

En la pestaña **Calendario** del torneo, configura las **fases** (rondas) con sus fechas y horarios:

```
Final            12 may – 12 may
Semifinal        05 may – 11 may
Cuartos          28 abr – 04 may
Octavos          21 abr – 27 abr
Primera ronda    14 abr – 20 abr
```

Cada partido se programará automáticamente dentro de la ventana de su fase.

### 4.3. Crear categorías

Dentro del torneo, agrega **categorías** (ej. "Singles A", "Dobles B"):

- Define modalidad, género, nivel mínimo/máximo y cupo máximo.
- Cada categoría tendrá su propia llave independiente.

### 4.4. Generar la llave (seeding)

Cuando termina el periodo de inscripción:

1. Abre la categoría → **Generar llave**.
2. **Paso 1 — Seeding**: ordena a los participantes (drag & drop) y asigna BYEs si los cupos no son potencia de 2.
3. **Paso 2 — Auto-asignación de horarios**: el sistema propone día, cancha y hora para cada partido de la primera ronda, dentro de las canchas dedicadas y la ventana de la fase, evitando solapes.
4. Puedes **mover manualmente** cada partido a otro hueco válido.
5. Confirma. Los partidos quedan **programados** y los jugadores reciben notificación para aceptar.

> Las rondas siguientes se autoprograman cuando se definen los rivales (al avanzar el ganador).

### 4.5. Gestionar el torneo en marcha

- **Ver el bracket** en tiempo real con estados de cada partido.
- **Reasignar partidos** si algún jugador se retira.
- **Ver solicitudes de cambio** y aprobarlas si fuera necesario.
- **Resolver disputas de resultado** desde el panel de admin.

### 4.6. Cierre del torneo

Cuando se juega la final, el ganador se registra automáticamente. El torneo queda en estado **finalizado** con su historial completo de partidos y resultados disponibles para todos los socios.

## 5. Reglas y validaciones automáticas

- Un jugador no puede inscribirse a dos categorías que se solapen en horario.
- Las canchas dedicadas no se pueden reservar por bookings normales mientras dura el torneo.
- Las solicitudes de cambio respetan la ventana de la fase y la antelación mínima configurada.
- Los partidos sin aceptación de ambos jugadores quedan visibles para el admin para reasignación.

## 6. Buenas prácticas

**Para jugadores**:
- Acepta tu partido lo antes posible para confirmar el horario.
- Si necesitas cambio, propónlo con anticipación.
- Reporta el resultado el mismo día del partido.

**Para administradores**:
- Define canchas dedicadas con holgura para absorber reagendamientos.
- Revisa que las fases tengan días suficientes entre rondas.
- Comunica con anticipación las reglas específicas del torneo (puntos de oro, tiebreaks, etc.).

## 7. Preguntas frecuentes

**¿Puedo cambiar de pareja en dobles después de inscribirme?**
Antes del cierre de inscripciones, sí. Después, solo el admin puede modificarlo en casos justificados.

**¿Qué pasa si llueve?**
El admin puede reprogramar partidos masivamente desde el panel del torneo. Los jugadores reciben notificación.

**¿Puedo ver partidos de torneos en los que no participo?**
Sí. Toda la información del bracket es pública para socios del club.

**¿Cuándo se actualiza mi ranking tras un torneo?**
Inmediatamente después de que cada partido se confirma con resultado.
$MD$,
  true,
  NULL,
  now()
);