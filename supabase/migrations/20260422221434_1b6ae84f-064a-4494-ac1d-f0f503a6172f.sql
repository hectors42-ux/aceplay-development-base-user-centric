-- Actualizar manual de uso con nuevos flujos (pirámide multi-paso, .ics, notificaciones)
UPDATE public.legal_documents
SET
  version = '2.0',
  updated_at = now(),
  content_md = $md$# Manual de uso AcePlay

## 🏠 Inicio
Desde el home accedes a:
- **Acciones pendientes:** desafíos por responder, propuestas de horario, resultados por confirmar.
- **Próxima reserva:** tu próximo partido con foto y detalle.
- **Rating:** tu nivel actual y categoría.
- **Atajos:** reservar, torneos, ranking.

## 📅 Reservar cancha
1. Toca **Reservar** en el menú inferior.
2. Elige fecha, cancha y horario disponible.
3. Selecciona tu compañero (socio del club).
4. Confirma. Llegará notificación a ambos.
5. Usa **Agregar a mi calendario** para descargar el evento (.ics) compatible con Google Calendar y Apple Calendar.

**Reglas:** puedes cancelar hasta 4h antes sin penalización.

## 🏆 Torneos
- Inscríbete en categorías abiertas.
- En dobles, invita a tu pareja: ella debe aceptar para confirmarte.
- Cuando juegues, propones el resultado y tu rival lo confirma.
- Cada partido programado incluye botón **Agregar a mi calendario**.

## 🪜 Pirámide (ladder)
La pirámide es competencia continua entre socios. Flujo del desafío:

1. **Desafiar:** elige a un rival hasta 5 posiciones por encima tuyo.
2. **Tu rival acepta o rechaza** dentro de la ventana de respuesta (horas).
3. **Propone hasta 3 horarios:** una vez aceptado, tu rival sugiere fechas y canchas.
4. **Tú confirmas un horario:** el sistema reserva la cancha automáticamente.
5. **Agrégalo a tu calendario** con un clic (.ics).
6. **Tras jugar**, uno de los dos carga el resultado y el otro lo confirma.
7. La pirámide se actualiza solo si gana el desafiante.

Desde **Ver estado** del desafío puedes seguir cuenta regresiva, timeline y los siguientes pasos.

## 🎾 Clases con coach
- Reserva clases individuales o compartidas.
- Cada clase confirmada se puede agregar al calendario externo.

## 📈 Ranking
- **Ranking del club:** estilo UTR, basado en partidos jugados.
- **Pirámide:** modo social de retos. Subes posiciones desafiando.
- **Mi evolución:** tu historial gráfico.

## 👤 Perfil
- Edita tu bio, mano dominante, golpe favorito, disponibilidad.
- Configura qué datos son visibles para el resto del club.
- Sube tu foto.

## 🔔 Notificaciones
La campanita arriba muestra todo lo que requiere tu atención:
- Desafíos recibidos / aceptados.
- Horarios propuestos por tu rival.
- Partidos confirmados (pirámide, torneos, reservas).
- Resultados pendientes de confirmar.
- Anuncios del club.

## 📆 Integración con calendario
La app genera archivos **.ics** que puedes importar a Google Calendar, Apple Calendar (iOS/macOS) o cualquier calendario compatible. La sincronización bidireccional automática llegará en una próxima versión.
$md$
WHERE id = 'd678c1d9-167c-402c-9e15-13cea57dc15d';

-- Marcar la guía de pirámide v2.0 como inactiva y crear v3.0
UPDATE public.legal_documents
SET is_active = false, updated_at = now()
WHERE id = '94f387ef-a733-4f87-a69e-c7725d7980df';

INSERT INTO public.legal_documents (kind, title, version, is_active, content_md, effective_at, tenant_id)
VALUES (
  'rating_explained',
  'Ranking y pirámide del club',
  '3.0',
  true,
  $md$# Ranking y pirámide del club

Esta guía explica cómo funciona el **ranking del club**, el sistema de **pirámide (ladder)** y cómo participar y hacer seguimiento de tu progreso.

## 1. ¿Qué es el ranking?

El ranking ordena a todos los socios según su **nivel de juego (rating)** calculado automáticamente a partir de los partidos oficiales: torneos, desafíos de pirámide y clases competitivas.

- A mejor nivel, **mejor posición** en el ranking.
- El ranking se separa por modalidad: **singles** y **dobles**.
- Cada jugador tiene además una **categoría** (A, B, C…) según su nivel y confiabilidad.

## 2. ¿Cómo se calcula mi nivel?

Tu nivel es un número entre **1.0 y 7.0** (escala estilo NTRP) que sube o baja después de cada partido oficial.

### Factores que influyen

- **Resultado del partido**: ganar suma puntos, perder los resta.
- **Diferencia de nivel con el rival**: ganarle a alguien mejor suma más; perder contra alguien peor resta más.
- **Confiabilidad (reliability)**: indica qué tan precisas son las estimaciones de tu nivel. Sube con cada partido jugado y baja con la inactividad.
- **Tipo de partido**: torneos y desafíos de pirámide tienen mayor peso que partidos amistosos.

### Test inicial

Cuando te registras, completas un **test inicial de nivel** que te ubica en una posición razonable de partida.

### Inactividad

Si dejas de jugar partidos oficiales por un tiempo prolongado, tu **confiabilidad baja gradualmente** (no tu nivel directamente).

## 3. Categorías del club

- **Categoría A**: jugadores avanzados.
- **Categoría B**: nivel intermedio.
- **Categoría C**: nivel inicial / en desarrollo.

## 4. La pirámide (ladder)

La pirámide es una **competencia continua** donde puedes desafiar a jugadores mejor posicionados. Si ganas, **tomas su lugar**.

### Cómo participar

1. Entra a la sección **Pirámide** desde el menú principal.
2. Si la pirámide está abierta a inscripciones, presiona **Unirme**.
3. Comenzarás en la última posición disponible.

### Reglas de desafío

- Solo puedes desafiar a jugadores con **mejor posición que tú** (número menor).
- El salto máximo permitido es de **5 posiciones** por encima tuyo (configurable por club).
- Cada par de jugadores tiene un **cooldown** entre desafíos (por defecto 3 días).
- No puedes tener varios desafíos activos en paralelo contra el mismo rival.

### Flujo completo del desafío

El nuevo flujo en 7 pasos te guía desde la app:

1. **Desafío enviado** — Tu rival recibe una notificación. Tienes botón **Ver estado** con cuenta regresiva (Vence en Xh Ym) y timeline visual.
2. **Tu rival acepta** dentro de la ventana de respuesta (48h por defecto). Recibes notificación inmediata.
3. **Propuesta de horarios** — El desafiado sugiere **hasta 3 fechas + cancha** dentro de la ventana de juego (7 días).
4. **Confirmación** — El desafiante elige uno de los 3 horarios. La cancha se **reserva automáticamente** y aparece como tu próxima reserva.
5. **Agregar a calendario** — Ambos pueden descargar el evento (.ics) para Google Calendar o Apple Calendar.
6. **Jugar** — En la fecha pactada, juegan el partido.
7. **Resultado** — Uno carga el resultado y el otro lo confirma. La pirámide se actualiza:
   - Si gana el **desafiante**: toma la posición del desafiado y este baja un puesto.
   - Si gana el **desafiado**: mantiene su posición. Solo se registran estadísticas.
   - Si alguien no se presenta: cuenta como **walkover** a favor del rival.

### Notificaciones de la pirámide

La campanita te avisa en cada paso clave:
- 🎯 Recibiste un desafío.
- ✅ Tu rival aceptó (toca para proponer horarios).
- 📅 Te propusieron 3 horarios (toca para elegir uno).
- 🏟️ Partido confirmado con cancha y hora.
- 📝 Resultado pendiente de cargar/confirmar.

### Inactividad en la pirámide

Si pasas demasiado tiempo sin jugar desafíos, puedes **bajar automáticamente** según las reglas configuradas.

## 5. Hacer seguimiento de tu progreso

- **Inicio** → tu tarjeta de jugador muestra nivel, categoría, rachas y posición.
- **Ranking** → ordenamiento completo del club, con podio.
- **Mi perfil** → historial completo de cambios de nivel y gráfica de evolución.
- **Pirámide** → tu posición actual, desafíos activos, historial y rivales sugeridos.

## 6. Insignias y logros

A medida que juegas, ganas **insignias** por hitos: primer partido, rachas, torneos, ascensos, etc. Las ves en **Mi perfil → Logros completos**.

## 7. Calendario externo

Cada partido programado (pirámide, torneos, reservas, clases) incluye botón **Agregar a mi calendario** que descarga un archivo `.ics` compatible con Google Calendar e iOS/macOS Calendar. La sincronización bidireccional automática se incorporará en el módulo de **Integraciones externas**.

## 8. Buenas prácticas

- **Juega con frecuencia**: mantiene alta tu confiabilidad y evita decay por inactividad.
- **Responde desafíos a tiempo**: respeta la ventana de 48h.
- **Propón horarios variados**: ofrecer 3 opciones acelera la coordinación.
- **Confirma resultados con honestidad**: el sistema depende de los marcadores reportados.
- **Si no puedes asistir, avisa**: cancela dentro de plazo o coordina walkover con tu rival.

## 9. Preguntas frecuentes

**¿Hasta cuántos puestos puedo subir en un solo desafío?**
Hasta 5 posiciones por encima tuyo (configurable por el club).

**¿Qué pasa si mi rival no propone horarios?**
El desafío expira al final de la ventana de juego y se libera el cooldown.

**¿Puedo cambiar el horario después de confirmado?**
Necesitas coordinar manualmente con tu rival y cancelar/reservar de nuevo.

**¿Por qué bajé de nivel si gané mi último partido?**
El ajuste depende de la diferencia de nivel y de tu confiabilidad acumulada.

**¿Qué pasa si me lesiono?**
Cancela los desafíos pendientes o coordina un walkover con tu rival.
$md$,
  now(),
  NULL
);