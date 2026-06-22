// ---------------------------------------------------------------------------
// Módulos dormidos — interruptor central para "despertar" una feature.
//
// Reservas y Clases son features del producto LEGACY que todavía NO tienen
// modelo de datos en el core "player-first" (no existen sus tablas: courts,
// bookings, coaches, coach_classes, ...). Mientras no se reconstruyan sobre el
// core nuevo (sin tenant_id), viven aquí como módulos DORMIDOS.
//
// Para activar un módulo cuando llegue el momento:
//   1. Construir su modelo de datos en el core (migraciones) y los RPCs.
//   2. Cablear sus hooks/páginas a esos RPCs (ya existen en el repo, ver
//      docs/dormant-modules.md).
//   3. Poner `enabled: true` aquí. Eso re-habilita rutas, navegación y home.
//
// Es el ÚNICO punto que hay que tocar para encender/apagar cada módulo.
// ---------------------------------------------------------------------------

export type ModuleKey = "reservas" | "clases";

// Cómo se piensa despertar cada módulo (solo documental, no cambia el runtime).
//  - "club-config": se activará por configuración de cada club (algunos clubs
//    gestionan canchas en la app, otros delegan a un proveedor externo).
//  - "post-mvp": dormido profundo, fuera del MVP; se retoma más adelante.
export type WakeMode = "club-config" | "post-mvp";

export interface ModuleConfig {
  /** Si está activo. Mientras sea false, rutas y nav muestran estado dormido. */
  enabled: boolean;
  wake: WakeMode;
  label: string;
  /** Texto que ve el usuario si llega por ruta directa a una pantalla dormida. */
  dormantCopy: string;
}

export const MODULES: Record<ModuleKey, ModuleConfig> = {
  // Reservas: dormido PENSADO para activarse por configuración de club.
  reservas: {
    enabled: false,
    wake: "club-config",
    label: "Reservas",
    dormantCopy:
      "La reserva de canchas se habilitará cuando tu club la configure. Por ahora esta sección no está activa.",
  },
  // Clases: dormido PROFUNDO, fuera del MVP.
  clases: {
    enabled: false,
    wake: "post-mvp",
    label: "Clases",
    dormantCopy:
      "Las clases con coach llegarán más adelante. Esta sección todavía no está activa.",
  },
};

export const isModuleEnabled = (key: ModuleKey): boolean => MODULES[key].enabled;
