# Módulos dormidos: Reservas y Clases

Estado a **2026-06-22**. Tras migrar el backend al core "player-first", **Reservas**
(reserva de canchas) y **Clases** (coaching) quedaron sin modelo de datos: sus tablas
del esquema viejo multi-tenant ya **no existen** (`courts`, `bookings`, `booking_rules`,
`coaches`, `coach_classes`, `coach_class_blocks`, `coach_settlements`, ...), y el core
**no usa `tenant_id`**.

En vez de borrarlos, se dejaron como **módulos dormidos limpios**: fuera de la navegación
del MVP, sin disparar RPCs muertos, y con un estado de pantalla "no disponible todavía" si
se llega por ruta directa. El código reaprovechable se preserva en el repo.

> Esto fue **consolidación, no construcción**: no se diseñó el modelo de datos nuevo de
> reservas ni de clases. Activarlos requiere construir ese modelo sobre el core (ver
> "Cómo despertar").

---

## Interruptor central

`src/config/modules.ts` es el **único punto** para encender/apagar cada módulo:

```ts
MODULES = {
  reservas: { enabled: false, wake: "club-config", ... },
  clases:   { enabled: false, wake: "post-mvp",    ... },
}
```

- **Reservas → `wake: "club-config"`**: dormido **pensado para activarse por configuración
  de cada club** más adelante (algunos clubs gestionan canchas en la app; otros delegan a un
  proveedor externo). Es el candidato más cercano a despertar.
- **Clases → `wake: "post-mvp"`**: dormido **profundo**, fuera del MVP.

`isModuleEnabled("reservas" | "clases")` se consulta en rutas, navegación y home. Mientras
`enabled` sea `false`:

- Las rutas (`/reservar`, `/mis-reservas`, `/admin/canchas`, `/clases`, `/coach`,
  `/admin/clases`) renderizan `ModuleDormant` (`src/components/ModuleDormant.tsx`) en vez de
  la página real → estado limpio, **nunca un error ni datos falsos**.
- No aparecen en el bottom-nav ni en las acciones rápidas.
- El Home no consulta `my_upcoming_bookings` (HeroRouter está gateado por el flag).

**Para despertar:** poner `enabled: true` (después de cablear el backend, ver abajo).

---

## Reservas — inventario y código reaprovechable

| Archivo | Rol | Estado |
|---|---|---|
| `src/pages/Reservar.tsx` | UI de reserva (día/duración/hora/cancha, partner, crear) | preservado, no ruteado |
| `src/pages/MisReservas.tsx` | "Mis reservas" (lista, cancelar, add-to-calendar) | preservado, no ruteado |
| `src/pages/AdminCourts.tsx` | Admin de canchas + reglas + proveedor externo | preservado, no ruteado |
| `src/lib/booking-utils.ts` | Slots, detección de conflictos, agrupar por superficie | **reutilizable tal cual** |
| `src/lib/external-bookings-copy.ts` | Copys del proveedor externo | reutilizable |
| `src/hooks/useBookingsProvider.ts` | Provider interno/externo | **stub** (devuelve `internal`) |
| `src/components/UpcomingBookingsLink.tsx` | Link home + `useMyUpcomingBookings` | preservado, fuera del home |
| `src/components/home/hero/HeroBookingNext.tsx` | Variante de hero "próxima reserva" | preservado |
| `src/components/booking/ExternalBookingCTA.tsx`, `BookingTrigger.tsx`, `UpcomingBookings.tsx` | varios | preservados |
| `src/components/admin/BookingsProviderCard.tsx` | Config de proveedor externo | preservado |

**Tablas/RPCs viejos que habría que reconstruir en el core (sin `tenant_id`):** tablas
`courts`, `bookings`, `booking_rules`; RPCs `my_upcoming_bookings`, `create_booking`,
`cancel_booking`, `unschedule_match`.

**Al despertar se reaprovecha:** toda la UI de `Reservar`/`MisReservas`/`AdminCourts` y la
lógica de `booking-utils.ts` (pura, sin backend). Solo hay que: (1) crear el modelo de datos
de canchas/reservas en el core, (2) reescribir los `supabase.from("courts"|"bookings"|...)`
y los RPCs contra el core, (3) `enabled: true`.

---

## Clases — inventario y código reaprovechable

| Archivo | Rol | Estado |
|---|---|---|
| `src/pages/Clases.tsx` | Tomar clase (coaches por deporte, tarifas) | preservado, no ruteado |
| `src/pages/CoachPanel.tsx` | Panel del coach (agenda, calendario, pagos) | preservado, no ruteado |
| `src/pages/AdminClases.tsx` | Admin (bloques horarios, liquidaciones) | preservado, no ruteado |
| `src/components/coach/TakeClassDialog.tsx` | Dialog reservar clase | preservado |
| `src/components/coach/CoachCreateClassDialog.tsx` | Dialog crear clase | preservado |
| `src/components/coach/CoachWeekCalendar.tsx` | Calendario semanal | reutilizable |
| `src/components/home/CoachUpcomingClassesCard.tsx` | Card home "mis clases" | preservado, fuera del home |
| `src/hooks/useCoaches.ts` | `useCoaches`, `useMyCoachProfile` | **stub** (devuelve `[]`/`null`) |
| `src/hooks/useCoachClasses.ts` | clases de alumno/coach | **stub** (devuelve `[]`) |
| `src/hooks/useAdminCoachData.ts` | bloques + liquidaciones | **stub** (no-op/`[]`) |

Los hooks ya estaban en stub (`enabled: false`, devuelven vacío) y **no referencian tablas
viejas**, así que no rompen el build ni disparan llamadas. Se les quitó `tenant_id` de las
interfaces para mantener **cero `tenant_id`** en el código activo.

**Tablas/RPCs viejos a reconstruir (sin `tenant_id`):** tablas `coaches`, `coach_classes`,
`coach_class_blocks`, `coach_settlements`; RPCs `confirm_coach_class`, `complete_coach_class`,
`cancel_coach_class`, `mark_class_paid`.

**Al despertar se reaprovecha:** toda la UI de `Clases`/`CoachPanel`/`AdminClases` y los
diálogos/calendario. Hay que cablear los stubs (`useCoaches`, `useCoachClasses`,
`useAdminCoachData`) a RPCs nuevos del core y poner `enabled: true`.

---

## Cómo despertar un módulo (resumen)

1. **Backend:** migraciones que creen su modelo en el core (**sin `tenant_id`**) + RPCs.
2. **Hooks:** cablear los stubs (reservas: `useBookingsProvider` + queries de `my_upcoming_bookings`/`create_booking`; clases: `useCoaches`/`useCoachClasses`/`useAdminCoachData`) contra esos RPCs.
3. **Páginas:** reapuntar los `supabase.from(...)`/`.rpc(...)` de las páginas preservadas al core.
4. **Flag:** `enabled: true` en `src/config/modules.ts`.
5. **Navegación:** volver a añadir los items en `BottomNav` y/o `QuickActions`, y las cards en `Index` (`UpcomingBookingsLink`, `CoachUpcomingClassesCard`), si corresponde.
6. **Tests:** reactivar los `it.skip` marcados `QUARANTINE` que dependían de la feature.
