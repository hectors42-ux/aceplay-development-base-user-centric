// Catálogo completo de escenarios E2E para módulos Competir y Torneos.
// Cada escenario declara: id, módulo, descripción, agentes involucrados,
// modo de ejecución (`auto` ejecuta vía runner; `manual` requiere navegador
// o auth real; `db-check` valida estado actual de la BD).
//
// El runner corre los `auto` y reporta los `manual` como pendientes con
// instrucciones claras para QA en preview.

export const SCENARIOS = [
  // ═══════════════════════════════════════════════════════════════
  // 2.1 Buscar Partner / Match Invitations
  // ═══════════════════════════════════════════════════════════════
  { id: "C-01", module: "competir/invitations", mode: "auto",
    desc: "Invitación con 3 slots, invitee elige slot 2",
    agents: ["A1", "A2"] },
  { id: "C-02", module: "competir/invitations", mode: "auto",
    desc: "Invitación expira sin respuesta (24h forzadas)",
    agents: ["A1", "A6"] },
  { id: "C-03", module: "competir/invitations", mode: "auto",
    desc: "Invitee rechaza con mensaje",
    agents: ["A2", "A5"] },
  { id: "C-04", module: "competir/invitations", mode: "auto",
    desc: "Inviter cancela antes de respuesta",
    agents: ["A1", "A3"] },
  { id: "C-05", module: "competir/invitations", mode: "db-check",
    desc: "Doble invitación al mismo invitee en mismo horario debe ser rechazada",
    agents: ["A1", "A2", "A6"] },
  { id: "C-06", module: "competir/invitations", mode: "manual",
    desc: "Carrera: invitee acepta slot ya tomado por reserva paralela",
    agents: ["A1", "A2"] },
  { id: "C-07", module: "competir/invitations", mode: "auto",
    desc: "Open post con 3 respondedores, inviter elige uno",
    agents: ["A1", "A2", "A5", "A9"] },
  { id: "C-08", module: "competir/invitations", mode: "auto",
    desc: "Open post expira a las 48h",
    agents: ["A6"] },
  { id: "C-09", module: "competir/invitations", mode: "manual",
    desc: "Filtros nivel ±0.5, días, superficie en buscar partner",
    agents: ["A1"] },

  // ═══════════════════════════════════════════════════════════════
  // 2.2 Resultados partner
  // ═══════════════════════════════════════════════════════════════
  { id: "C-10", module: "competir/results", mode: "auto",
    desc: "A propone resultado, B confirma → ratings actualizados",
    agents: ["A1", "A2"] },
  { id: "C-11", module: "competir/results", mode: "auto",
    desc: "A propone, B rechaza con motivo",
    agents: ["A1", "A5"] },
  { id: "C-12", module: "competir/results", mode: "manual",
    desc: "A propone, B no responde 72h → recordatorio edge function",
    agents: ["A1", "A6"] },
  { id: "C-13", module: "competir/results", mode: "auto",
    desc: "Walkover (B no se presentó) cargado por A",
    agents: ["A1", "A10"] },
  { id: "C-14", module: "competir/results", mode: "auto",
    desc: "Retiro a mitad (lesión) con score parcial válido",
    agents: ["A1", "A11"] },
  { id: "C-15", module: "competir/results", mode: "manual",
    desc: "Score inválido (6-7 sin TB) bloqueado en UI",
    agents: ["A1"] },
  { id: "C-16", module: "competir/results", mode: "db-check",
    desc: "Doble propuesta de resultado no genera duplicado",
    agents: ["A1", "A2"] },
  { id: "C-17", module: "competir/notifications", mode: "manual",
    desc: "Eliminar notificación de resultado pendiente → no reaparece",
    agents: ["A1"] },

  // ═══════════════════════════════════════════════════════════════
  // 2.3 Pirámide
  // ═══════════════════════════════════════════════════════════════
  { id: "C-18", module: "competir/ladder", mode: "db-check",
    desc: "Salto > max_position_jump bloqueado",
    agents: ["A2", "A4"] },
  { id: "C-19", module: "competir/ladder", mode: "auto",
    desc: "Desafío con 3 slots, retado elige uno",
    agents: ["A2", "A5"] },
  { id: "C-20", module: "competir/ladder", mode: "auto",
    desc: "Retado rechaza con motivo",
    agents: ["A9", "A6"] },
  { id: "C-21", module: "competir/ladder", mode: "auto",
    desc: "Retado deja expirar response_window_hours → auto-W.O.",
    agents: ["A2", "A6"] },
  { id: "C-21-neg", module: "competir/ladder", mode: "auto",
    desc: "Negativo: desafío vigente NO debe generar walkover ni mover posiciones",
    agents: ["A2", "A6"] },
  { id: "C-21-idem", module: "competir/ladder", mode: "auto",
    desc: "Idempotencia/concurrencia: 5x secuencial + 5x concurrente NO duplica W.O.",
    agents: ["A2", "A6"] },
  { id: "C-22", module: "competir/ladder", mode: "db-check",
    desc: "Cooldown bloquea segundo desafío al mismo rival",
    agents: ["A2", "A5"] },
  { id: "C-23", module: "competir/ladder", mode: "auto",
    desc: "Walkover por inasistencia → retador sube",
    agents: ["A9", "A10"] },
  { id: "C-24", module: "competir/ladder", mode: "auto",
    desc: "Resultado: retador gana → swap de posiciones",
    agents: ["A2", "A5"] },
  { id: "C-25", module: "competir/ladder", mode: "auto",
    desc: "Resultado: retado gana → sin swap (loser_drops=false)",
    agents: ["A9", "A6"] },
  { id: "C-26", module: "competir/ladder", mode: "auto",
    desc: "Inactividad 30 días: process_ladder_inactivity_run baja al inactivo",
    agents: ["A12"] },
  { id: "C-27", module: "competir/ladder", mode: "manual",
    desc: "Slot conflictúa con bloque de clase → rechaza ese slot",
    agents: ["A2", "A5"] },
  { id: "C-28", module: "competir/ladder", mode: "manual",
    desc: "Cancha dedicada a torneo bloquea agendamiento de pirámide",
    agents: ["A2", "A5"] },
  { id: "C-29", module: "competir/notifications", mode: "manual",
    desc: "Eliminar notif de desafío recibido tras aceptar",
    agents: ["A6"] },
  { id: "C-29b", module: "competir/notifications", mode: "db-check",
    desc: "Dismissal individual: registrar y verificar notification_dismissals",
    agents: ["A2"] },
  { id: "C-29c", module: "competir/notifications", mode: "db-check",
    desc: "Dismissal masivo: 'Eliminar todas' borra dismissals visibles y conteo final = 0",
    agents: ["A2"] },
  { id: "C-30b", module: "competir/notifications", mode: "db-check",
    desc: "Contador suma: ladder_pending_counts + invitaciones pending coincide con badge",
    agents: ["A2"] },
  { id: "C-30c", module: "competir/notifications", mode: "db-check",
    desc: "Contadores por usuario aislados: invitaciones de A2 y A6 no se mezclan",
    agents: ["A1", "A2", "A6"] },
  { id: "C-30d", module: "competir/notifications", mode: "db-check",
    desc: "Badge pestaña Pirámide = ladder_pending_counts.total (paridad backend↔UI)",
    agents: ["A2"] },
  { id: "C-INV-PROP", module: "competir/ladder", mode: "db-check",
    desc: "Invariante: ningún desafío 'propuesto' sin slot1_starts_at + slot1_court_id",
    agents: [] },
  { id: "C-INV-PROP-NEG", module: "competir/ladder", mode: "db-check",
    desc: "Negativo: BD rechaza proposals sin slot1 completo y trigger bloquea nullify",
    agents: ["A1", "A2"] },
  { id: "AUTH-NAME", module: "auth/profile", mode: "db-check",
    desc: "Demo user muestra nombre real al ingresar; nunca 'Socio' genérico ni pre-apertura",
    agents: ["A1"] },

  // ═══════════════════════════════════════════════════════════════
  // 2.4 Dobles
  // ═══════════════════════════════════════════════════════════════
  { id: "C-31", module: "competir/doubles", mode: "manual",
    desc: "Pareja A7+A8 invita a A1+A2 con 3 slots",
    agents: ["A1", "A2", "A7", "A8"] },
  { id: "C-32", module: "competir/doubles", mode: "manual",
    desc: "Solo 1 de 2 invitados acepta → queda pendiente",
    agents: ["A1", "A2", "A7", "A8"] },
  { id: "C-33", module: "competir/doubles", mode: "manual",
    desc: "Resultado dobles: ratings individuales actualizados",
    agents: ["A1", "A2", "A7", "A8"] },
  { id: "C-34", module: "competir/doubles", mode: "manual",
    desc: "Walkover dobles (1 no llega) → pareja entera W.O.",
    agents: ["A7", "A8"] },

  // ═══════════════════════════════════════════════════════════════
  // 2.5 Open Match Slots (Fase B/C unificada)
  // ═══════════════════════════════════════════════════════════════
  { id: "OS-01", module: "competir/open-match", mode: "auto",
    desc: "Crear open match singles → trigger semilla 2 slots (team1=autor, team2=null)",
    agents: ["A1"] },
  { id: "OS-02", module: "competir/open-match", mode: "auto",
    desc: "Crear open match pair_vs_pair → 4 slots, team1 completo (autor + partner)",
    agents: ["A7", "A8"] },
  { id: "OS-03", module: "competir/open-match", mode: "auto",
    desc: "Llenar último slot → trigger marca post como 'confirmed'",
    agents: ["A1", "A2"] },
  { id: "OS-04", module: "competir/open-match", mode: "auto",
    desc: "Leave: limpiar user_id de un slot → post vuelve a 'open' y queda libre",
    agents: ["A1", "A2"] },

  // ═══════════════════════════════════════════════════════════════
  // 3.1 Torneos — Inscripción
  // ═══════════════════════════════════════════════════════════════
  { id: "T-01", module: "torneos/registration", mode: "db-check",
    desc: "8 inscripciones llenan cupo, 9° entra en lista de espera",
    agents: ["A1","A2","A3","A4","A5","A6","A7","A8","A9"] },
  { id: "T-02", module: "torneos/registration", mode: "manual",
    desc: "Retiro 24h antes → cupo libera, lista de espera promueve",
    agents: ["A11", "A9"] },
  { id: "T-03", module: "torneos/registration", mode: "manual",
    desc: "Dobles: A7 invita a A8, A8 confirma",
    agents: ["A7", "A8"] },
  { id: "T-04", module: "torneos/registration", mode: "manual",
    desc: "Dobles: A8 no confirma antes del cierre → pendiente_pareja → retirada",
    agents: ["A7", "A8"] },
  { id: "T-05", module: "torneos/registration", mode: "manual",
    desc: "Admin aprueba/rechaza inscripciones (modo admin_approval)",
    agents: ["A12"] },
  { id: "T-06", module: "torneos/registration", mode: "db-check",
    desc: "Inscripción duplicada bloqueada",
    agents: ["A1"] },

  // ═══════════════════════════════════════════════════════════════
  // 3.2 Seeding y bracket
  // ═══════════════════════════════════════════════════════════════
  { id: "T-07", module: "torneos/seeding", mode: "manual",
    desc: "Generar llave 8 inscritos: bracket 3 rondas, seeds respetados",
    agents: ["A12"] },
  { id: "T-08", module: "torneos/seeding", mode: "db-check",
    desc: "Auto-asignación usa solo canchas dedicadas",
    agents: ["A12"] },
  { id: "T-09", module: "torneos/seeding", mode: "manual",
    desc: "Slots insuficientes → warning UI, admin re-asigna",
    agents: ["A12"] },
  { id: "T-10", module: "torneos/seeding", mode: "manual",
    desc: "Re-generar llave con resultados ya cargados → bloquea",
    agents: ["A12"] },

  // ═══════════════════════════════════════════════════════════════
  // 3.3 Aceptación y reschedule
  // ═══════════════════════════════════════════════════════════════
  { id: "T-11", module: "torneos/match", mode: "auto",
    desc: "Ambos jugadores aceptan → status=programado",
    agents: ["A1", "A2"] },
  { id: "T-12", module: "torneos/match", mode: "auto",
    desc: "Uno rechaza con motivo → vuelve al admin",
    agents: ["A1", "A6"] },
  { id: "T-13", module: "torneos/match", mode: "auto",
    desc: "Reschedule único permitido se acepta",
    agents: ["A1", "A2"] },
  { id: "T-14", module: "torneos/match", mode: "db-check",
    desc: "Segundo reschedule rechazado por reschedule_used=true",
    agents: ["A1", "A2"] },
  { id: "T-15", module: "torneos/match", mode: "db-check",
    desc: "Reschedule fuera de fase rechazado",
    agents: ["A1", "A2"] },
  { id: "T-16", module: "torneos/match", mode: "db-check",
    desc: "Reschedule a slot ocupado rechazado",
    agents: ["A1", "A2"] },
  { id: "T-17", module: "torneos/match", mode: "db-check",
    desc: "Jugador no participante NO puede aceptar (RLS)",
    agents: ["A6"] },

  // ═══════════════════════════════════════════════════════════════
  // 3.4 Carga de resultados
  // ═══════════════════════════════════════════════════════════════
  { id: "T-18", module: "torneos/results", mode: "db-check",
    desc: "Modo solo_admin: jugador no puede cargar",
    agents: ["A1"] },
  { id: "T-19", module: "torneos/results", mode: "auto",
    desc: "jugadores_con_confirmacion: A propone, B confirma",
    agents: ["A1", "A2"] },
  { id: "T-20", module: "torneos/results", mode: "auto",
    desc: "jugadores_con_aprobacion_admin: A propone, A12 aprueba",
    agents: ["A1", "A2", "A12"] },
  { id: "T-21", module: "torneos/results", mode: "manual",
    desc: "Score inválido bloqueado en UI",
    agents: ["A1"] },
  { id: "T-22", module: "torneos/results", mode: "auto",
    desc: "Walkover por inasistencia → avanza rival",
    agents: ["A10", "A1"] },
  { id: "T-23", module: "torneos/results", mode: "auto",
    desc: "Retiro en partido con score parcial",
    agents: ["A11", "A1"] },
  { id: "T-24", module: "torneos/results", mode: "manual",
    desc: "Resultado de final → torneo finalizado, campeón persistido",
    agents: ["A12"] },

  // ═══════════════════════════════════════════════════════════════
  // 3.5 Notificaciones torneo
  // ═══════════════════════════════════════════════════════════════
  { id: "T-25", module: "torneos/notifications", mode: "db-check",
    desc: "Notif 'partido programado' visible para ambos",
    agents: ["A1", "A2"] },
  { id: "T-26", module: "torneos/notifications", mode: "manual",
    desc: "Eliminar notif individual de torneo no reaparece",
    agents: ["A1"] },
  { id: "T-27", module: "torneos/notifications", mode: "manual",
    desc: "Bulk dismiss elimina solo vistas",
    agents: ["A1"] },
  { id: "T-28", module: "torneos/notifications", mode: "manual",
    desc: "Reintentos automáticos al fallar dismiss offline",
    agents: ["A1"] },

  // ═══════════════════════════════════════════════════════════════
  // 3.6 Cross-module
  // ═══════════════════════════════════════════════════════════════
  { id: "X-01", module: "cross", mode: "manual",
    desc: "Pirámide en cancha dedicada a torneo: bloqueado",
    agents: ["A2", "A5"] },
  { id: "X-02", module: "cross", mode: "manual",
    desc: "Reservar muestra meta 'Torneo' en bookings kind=torneo",
    agents: ["A1"] },
  { id: "X-03", module: "cross", mode: "manual",
    desc: "BracketView muestra badge 'EN VIVO' 90min post-start",
    agents: ["A1"] },
  { id: "X-04", module: "cross", mode: "db-check",
    desc: "Resultado torneo registra rating_history.source='torneo'",
    agents: ["A1", "A2"] },
  { id: "X-05", module: "cross", mode: "manual",
    desc: "Sugerencia de partner penaliza días con torneo activo",
    agents: ["A1"] },
];

// Marcar todos los escenarios anteriores como tenis (default).
for (const s of SCENARIOS) if (!s.sport) s.sport = "tenis";

// ═══════════════════════════════════════════════════════════════
// PÁDEL — Espejo de los flujos críticos sobre el roster P1..P8
// (mismo tenant Stade Français, datos paralelos al de tenis)
// ═══════════════════════════════════════════════════════════════
SCENARIOS.push(
  // ── Open Match dobles pádel (4 slots) ─────────────────────────
  { id: "OS-P1", sport: "padel", module: "competir/open-match", mode: "auto",
    desc: "[pádel] Open match dobles open_slots → 4 slots, autor en team1",
    agents: ["P1"] },
  { id: "OS-P2", sport: "padel", module: "competir/open-match", mode: "auto",
    desc: "[pádel] Open match pair_vs_pair → team1 con autor+partner, team2 vacío",
    agents: ["P1", "P2"] },
  { id: "OS-P3", sport: "padel", module: "competir/open-match", mode: "auto",
    desc: "[pádel] Completar últimos 2 slots → status='matched'",
    agents: ["P1", "P2", "P3", "P4"] },
  { id: "OS-P4", sport: "padel", module: "competir/open-match", mode: "auto",
    desc: "[pádel] Leave: liberar slot → post vuelve a 'open'",
    agents: ["P1", "P2", "P3", "P4"] },

  // ── La Pirámide pádel ──────────────────────────────────────
  { id: "CP-18", sport: "padel", module: "competir/ladder", mode: "db-check",
    desc: "[pádel] Salto > max_position_jump bloqueado en pádel dobles",
    agents: ["P2", "P4"] },
  { id: "CP-19", sport: "padel", module: "competir/ladder", mode: "auto",
    desc: "[pádel] Desafío dobles con 3 slots, retados eligen uno",
    agents: ["P1", "P2", "P4", "P5"] },
  { id: "CP-21", sport: "padel", module: "competir/ladder", mode: "auto",
    desc: "[pádel] response_window expira → auto-W.O. dobles",
    agents: ["P4", "P5", "P1", "P2"] },
  { id: "CP-22", sport: "padel", module: "competir/ladder", mode: "db-check",
    desc: "[pádel] Cooldown bloquea segundo desafío al mismo rival",
    agents: ["P2", "P3"] },
  { id: "CP-23", sport: "padel", module: "competir/ladder", mode: "auto",
    desc: "[pádel] Walkover dobles por inasistencia → retadores suben",
    agents: ["P5", "P6", "P1", "P2"] },
  { id: "CP-24", sport: "padel", module: "competir/ladder", mode: "auto",
    desc: "[pádel] Resultado: retadores ganan → swap pareja (partners no se mueven)",
    agents: ["P4", "P5", "P1", "P2"] },
  { id: "CP-26", sport: "padel", module: "competir/ladder", mode: "auto",
    desc: "[pádel] Inactividad 30d en La Pirámide Pádel",
    agents: [] },

  // ── Torneos pádel ────────────────────────────────────────────
  { id: "TP-01", sport: "padel", module: "torneos/registration", mode: "db-check",
    desc: "[pádel] Inscripciones del Open Pádel Stade (cupo dobles)",
    agents: ["P1","P2","P3","P4","P5","P6","P7","P8"] },
  { id: "TP-11", sport: "padel", module: "torneos/match", mode: "auto",
    desc: "[pádel] Ambas parejas aceptan → status=programado",
    agents: ["P1", "P2", "P3", "P4"] },
  { id: "TP-19", sport: "padel", module: "torneos/results", mode: "auto",
    desc: "[pádel] Resultado con confirmación de la pareja rival",
    agents: ["P1", "P2", "P3", "P4"] },
  { id: "TP-22", sport: "padel", module: "torneos/results", mode: "auto",
    desc: "[pádel] Walkover dobles avanza a la pareja rival",
    agents: ["P5", "P6", "P7", "P8"] },

  // ── Partner search + invitaciones pádel (IP-* para no colisionar con CP-ladder) ──
  { id: "IP-01", sport: "padel", module: "competir/invitations", mode: "auto",
    desc: "[pádel] Invitación dobles con 3 slots, partner acepta uno",
    agents: ["P1", "P2"] },
  { id: "IP-02", sport: "padel", module: "competir/invitations", mode: "auto",
    desc: "[pádel] Invitación pádel expira sin respuesta",
    agents: ["P1", "P8"] },
  { id: "IP-07", sport: "padel", module: "competir/invitations", mode: "auto",
    desc: "[pádel] Open post pádel con 3 respondedores",
    agents: ["P1", "P3", "P5", "P7"] },
  { id: "IP-09", sport: "padel", module: "competir/invitations", mode: "db-check",
    desc: "[pádel] Filtros nivel ±0.5 / superficie en partner search pádel",
    agents: ["P1"] },
);


export function summary() {
  const byMode = SCENARIOS.reduce((acc, s) => {
    acc[s.mode] = (acc[s.mode] ?? 0) + 1;
    return acc;
  }, {});
  const byModule = SCENARIOS.reduce((acc, s) => {
    acc[s.module] = (acc[s.module] ?? 0) + 1;
    return acc;
  }, {});
  const bySport = SCENARIOS.reduce((acc, s) => {
    acc[s.sport] = (acc[s.sport] ?? 0) + 1;
    return acc;
  }, {});
  return { total: SCENARIOS.length, byMode, byModule, bySport };
}

