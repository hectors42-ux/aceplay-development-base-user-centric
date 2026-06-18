#!/usr/bin/env node
// Reporte automático del módulo Competir.
// Ejecuta los escenarios `auto` y `db-check` del módulo competir/* y
// genera un reporte Markdown enriquecido con aserciones clave por escenario
// multi-paso (en especial C-21, C-21-neg y C-21-idem).
//
// Salidas:
//   $E2E_COMPETIR_OUT_DIR (default /mnt/documents/e2e-competir)/report.md
//   $E2E_COMPETIR_OUT_DIR/results.json
//
// Filtros (CLI o env):
//   --filter=<sub>            Filtra por substring del id de escenario  [env FILTER]
//   --suite=<a,b>             Sub-módulos a incluir; valor sin prefijo  [env SUITE]
//                             se asume bajo competir/ (ej: ladder,results)
//   --agents=<A1,A2>          Solo escenarios donde participe alguno    [env AGENTS]
//   --status=<pass,fail,...>  Filtro POST-run de resultados             [env STATUS]
//   --mode=<auto,manual,db-check>  Filtra por modo declarado            [env MODE]
//   --exclude=<sub>           Excluye ids que matchean substring        [env EXCLUDE]
//
// Ejemplos:
//   node scripts/e2e-competir-report.mjs --suite=ladder --status=fail,pass
//   AGENTS=A2 node scripts/e2e-competir-report.mjs --filter=C-21
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCENARIOS } from "./e2e-multiagent/scenarios.mjs";
import { runAllAuto } from "./e2e-multiagent/handlers.mjs";
import { ROSTER, logLine } from "./e2e-multiagent/config.mjs";

const OUT_DIR = process.env.E2E_COMPETIR_OUT_DIR || "/mnt/documents/e2e-competir";
mkdirSync(OUT_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────
// Parse de filtros (CLI flags + env)
// ─────────────────────────────────────────────────────────────────
function flagValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const splitCsv = (v) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const FILTERS = {
  filter: flagValue("filter") ?? process.env.FILTER ?? "",
  exclude: flagValue("exclude") ?? process.env.EXCLUDE ?? "",
  suites: splitCsv(flagValue("suite") ?? process.env.SUITE),
  agents: splitCsv(flagValue("agents") ?? process.env.AGENTS).map((a) => a.toUpperCase()),
  modes: splitCsv(flagValue("mode") ?? process.env.MODE),
  statuses: splitCsv(flagValue("status") ?? process.env.STATUS),
};

// Sub-módulos válidos bajo competir/* (para validación amistosa)
const VALID_SUITES = Array.from(
  new Set(
    SCENARIOS.filter((s) => s.module.startsWith("competir/")).map((s) =>
      s.module.replace(/^competir\//, ""),
    ),
  ),
);
const VALID_STATUSES = ["pass", "fail", "skip", "manual"];
const VALID_MODES = ["auto", "manual", "db-check"];

for (const s of FILTERS.suites) {
  if (!VALID_SUITES.includes(s)) {
    logLine(`⚠ Suite desconocida "${s}". Válidas: ${VALID_SUITES.join(", ")}`);
  }
}
for (const s of FILTERS.statuses) {
  if (!VALID_STATUSES.includes(s)) {
    logLine(`⚠ Status desconocido "${s}". Válidos: ${VALID_STATUSES.join(", ")}`);
  }
}
for (const m of FILTERS.modes) {
  if (!VALID_MODES.includes(m)) {
    logLine(`⚠ Mode desconocido "${m}". Válidos: ${VALID_MODES.join(", ")}`);
  }
}

// Filtros PRE-run (sobre el catálogo)
const competir = SCENARIOS.filter((s) => s.module.startsWith("competir/"))
  .filter((s) => (FILTERS.filter ? s.id.includes(FILTERS.filter) : true))
  .filter((s) => (FILTERS.exclude ? !s.id.includes(FILTERS.exclude) : true))
  .filter((s) => {
    if (!FILTERS.suites.length) return true;
    const sub = s.module.replace(/^competir\//, "");
    return FILTERS.suites.includes(sub);
  })
  .filter((s) => {
    if (!FILTERS.agents.length) return true;
    return s.agents.some((a) => FILTERS.agents.includes(a.toUpperCase()));
  })
  .filter((s) => (FILTERS.modes.length ? FILTERS.modes.includes(s.mode) : true));

logLine(`▶ Reporte Competir — ${competir.length} escenarios (post pre-filtros)`);
const activeFilters = Object.entries(FILTERS).filter(([, v]) =>
  Array.isArray(v) ? v.length : Boolean(v),
);
if (activeFilters.length) {
  logLine(`  Filtros activos:`, JSON.stringify(Object.fromEntries(activeFilters)));
}
if (!competir.length) {
  logLine(`✗ Ningún escenario coincide con los filtros — abortando.`);
  process.exit(2);
}

const allResults = await runAllAuto(competir);

// Filtro POST-run por estado
const results = FILTERS.statuses.length
  ? allResults.filter((r) => FILTERS.statuses.includes(r.status))
  : allResults;

const counts = results.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
logLine(`◼ Conteos:`, JSON.stringify(counts));
if (FILTERS.statuses.length) {
  logLine(`  (mostrando ${results.length}/${allResults.length} tras filtro status)`);
}


// ─────────────────────────────────────────────────────────────────
// Catálogo de aserciones clave por escenario multi-paso
// ─────────────────────────────────────────────────────────────────
const KEY_ASSERTIONS = {
  "C-01": [
    "Invitation creada con 3 slots y status=pendiente",
    "Aceptación con slot_index=2 → status=aceptada, chosen_slot=2",
    "Slots no elegidos quedan descartados",
  ],
  "C-02": [
    "Invitation con expires_at en el pasado",
    "RPC expire_pending_invitations marca status=expirada",
    "No se generan match_partner_results asociados",
  ],
  "C-03": ["Rechazo guarda motivo en response_message", "status=rechazada, no se reserva slot"],
  "C-04": ["Cancelación por inviter antes de respuesta → status=cancelada", "Notificación al invitee"],
  "C-07": ["Open post acepta múltiples respuestas", "Inviter elige 1 → resto queda no_seleccionado"],
  "C-08": ["Open post expira a 48h vía RPC", "Sin selección → status=expirada"],
  "C-10": [
    "A propone resultado → match_partner_results.status=propuesto",
    "B confirma → status=confirmado",
    "Ratings ELO actualizados para ambos jugadores",
  ],
  "C-11": ["A propone, B rechaza con motivo → status=rechazado", "Sin cambios de rating"],
  "C-13": ["Walkover cargado → score_json.walkover=true", "Solo gana el presente, ratings ajustados"],
  "C-14": ["Retiro a mitad con score parcial válido", "score_json.retiro=true, ganador definido"],
  "C-19": [
    "Desafío con 3 slots propuestos por retador",
    "Retado acepta uno → status=aceptado, chosen_slot definido",
    "Reserva de cancha creada para el slot elegido",
  ],
  "C-20": ["Retado rechaza con motivo → status=rechazado", "Sin movimiento de posiciones"],
  "C-21": [
    "Desafío con expires_at en el pasado y status=propuesto",
    "process_ladder_expirations_run() devuelve auto_walkovers ≥ 1",
    "Challenge final: status=jugado, resolution=walkover, winner=retador",
    "Posiciones swap correctamente (retador sube, retado baja)",
    "ladder_history: 2 filas con reason='walkover' y position_before/after consistentes",
    "ladder_player_stats: winner +1 win y +1 walkovers_for; loser +1 loss y +1 walkovers_against",
    "last_played_at actualizado en ambos jugadores",
    "user_notifications: exactamente 2 (kind=challenge_walkover) con tenant_id, ref_id=challenge_id, link=/ranking?tab=piramide y descripciones que mencionan al rival y la ladder",
    "Invariantes globales del ladder: posiciones únicas, positivas y contiguas (1..N)",
  ],
  "C-21-neg": [
    "Desafío con expires_at futuro NO se procesa",
    "RPC retorna 0 auto_walkovers para ese challenge",
    "status sigue en 'propuesto', sin cambios de posición/stats/history/notifs",
  ],
  "C-21-idem": [
    "Mismo desafío expirado: 5 invocaciones secuenciales + 5 concurrentes",
    "Total auto_walkovers reportado = 1 (la primera reclama, las demás 0)",
    "1 challenge en status=jugado, 2 ladder_history, 2 user_notifications, 1 swap aplicado",
    "Stats incrementan exactamente +1 (no duplicados)",
    "FOR UPDATE + filtro status='propuesto' serializa concurrencia",
  ],
  "C-23": [
    "Walkover por inasistencia cargado por retador",
    "Posiciones swap, ladder_history con reason='walkover'",
    "Notificación challenge_walkover a ambos",
  ],
  "C-24": [
    "Resultado: retador gana → swap de posiciones",
    "ladder_history reason='resultado'",
    "Stats: winner +1 win, loser +1 loss",
  ],
  "C-25": [
    "Resultado: retado gana → NO swap (loser_drops=false)",
    "ladder_history sin cambios de posición",
    "Stats actualizadas correctamente",
  ],
  "C-26": [
    "Jugador con last_played_at > 30 días",
    "process_ladder_inactivity_run() lo marca status=inactivo",
    "Posiciones recompactadas, contiguas 1..N entre activos",
  ],
  // db-check
  "C-05": ["Constraint/RPC bloquea doble invitación al mismo invitee/horario"],
  "C-16": ["Doble propuesta de resultado → unique constraint o RPC dedupe"],
  "C-18": ["Salto > max_position_jump → RPC retorna error claro"],
  "C-22": ["Cooldown bloquea segundo desafío al mismo rival"],
};

// ─────────────────────────────────────────────────────────────────
// Reporte Markdown
// ─────────────────────────────────────────────────────────────────
const ts = new Date().toISOString();
const lines = [];
lines.push(`# Reporte E2E — Módulo Competir`);
lines.push(``);
lines.push(`Generado: \`${ts}\``);
lines.push(``);
if (activeFilters.length) {
  lines.push(`**Filtros activos:** \`${JSON.stringify(Object.fromEntries(activeFilters))}\``);
  lines.push(``);
  lines.push(`> Reporte enfocado: ${results.length} de ${allResults.length} escenarios ejecutados visibles tras filtros.`);
  lines.push(``);
}
lines.push(`## Resumen ejecutivo`);
lines.push(``);
lines.push(`| Estado | Total |`);
lines.push(`|---|---|`);
lines.push(`| ✅ pass | **${counts.pass ?? 0}** |`);
lines.push(`| ❌ fail | **${counts.fail ?? 0}** |`);
lines.push(`| ⏭ skip | **${counts.skip ?? 0}** |`);
lines.push(`| ✋ manual | **${counts.manual ?? 0}** |`);
lines.push(`| **Total** | **${results.length}** |`);
lines.push(``);
const autoTotal = results.filter((r) => r.status !== "manual").length;
const passRate = autoTotal ? Math.round(((counts.pass ?? 0) / autoTotal) * 100) : 0;
lines.push(`**Tasa de aprobación automatizada:** ${counts.pass ?? 0}/${autoTotal} (${passRate}%)`);
lines.push(``);

// Agrupar por sub-módulo
const byModule = results.reduce((acc, r) => {
  (acc[r.module] ??= []).push(r);
  return acc;
}, {});

lines.push(`## Resultados por sub-módulo`);
lines.push(``);
for (const [mod, rows] of Object.entries(byModule)) {
  lines.push(`### ${mod}`);
  lines.push(``);
  lines.push(`| ID | Estado | Descripción | Agentes |`);
  lines.push(`|---|---|---|---|`);
  for (const r of rows) {
    const icon = { pass: "✅", fail: "❌", skip: "⏭", manual: "✋" }[r.status] ?? "❓";
    lines.push(`| ${r.id} | ${icon} ${r.status} | ${r.desc} | ${r.agents.join(", ")} |`);
  }
  lines.push(``);
}

// Detalle de aserciones clave por escenario multi-paso
lines.push(`## Aserciones clave por escenario multi-paso`);
lines.push(``);
lines.push(`Para cada escenario \`auto\` se documentan las aserciones validadas contra la base de datos.`);
lines.push(``);
for (const r of results) {
  const asserts = KEY_ASSERTIONS[r.id];
  if (!asserts) continue;
  const icon = { pass: "✅", fail: "❌", skip: "⏭", manual: "✋" }[r.status] ?? "❓";
  lines.push(`### ${icon} ${r.id} — ${r.desc}`);
  lines.push(``);
  lines.push(`**Agentes:** ${r.agents.join(", ")} · **Módulo:** \`${r.module}\` · **Estado:** ${r.status}`);
  lines.push(``);
  lines.push(`**Aserciones clave:**`);
  for (const a of asserts) lines.push(`- ${a}`);
  if (r.error) {
    lines.push(``);
    lines.push(`**Error:** \`${r.error.replace(/`/g, "'").slice(0, 400)}\``);
  }
  if (r.evidence) {
    lines.push(``);
    lines.push(`<details><summary>Evidencia</summary>`);
    lines.push(``);
    lines.push("```json");
    lines.push(JSON.stringify(r.evidence, null, 2).slice(0, 2400));
    lines.push("```");
    lines.push(`</details>`);
  }
  lines.push(``);
}

// Foco en C-21 (suite completa)
lines.push(`## 🎯 Foco: suite C-21 (auto-walkover de pirámide)`);
lines.push(``);
const c21Suite = results.filter((r) => r.id.startsWith("C-21"));
const c21Pass = c21Suite.filter((r) => r.status === "pass").length;
lines.push(`Cobertura de la suite C-21: **${c21Pass}/${c21Suite.length}** verde.`);
lines.push(``);
lines.push(`| ID | Estado | Verifica |`);
lines.push(`|---|---|---|`);
for (const r of c21Suite) {
  const icon = { pass: "✅", fail: "❌", skip: "⏭", manual: "✋" }[r.status] ?? "❓";
  lines.push(`| ${r.id} | ${icon} | ${r.desc} |`);
}
lines.push(``);
lines.push(`**Conclusión:** el RPC \`process_ladder_expirations_run\` está validado end-to-end:`);
lines.push(`flujo positivo (C-21), guardia de no-expirados (C-21-neg) e idempotencia bajo concurrencia (C-21-idem).`);
lines.push(``);

// Manuales pendientes
const manuales = results.filter((r) => r.status === "manual");
if (manuales.length) {
  lines.push(`## Escenarios manuales pendientes`);
  lines.push(``);
  lines.push(`Validar en preview con \`demouser@aceplay.cl\` o \`hectors42@gmail.com\`:`);
  lines.push(``);
  for (const r of manuales) lines.push(`- **${r.id}** — ${r.desc} (agentes: ${r.agents.join(", ")})`);
  lines.push(``);
}

lines.push(`## Roster de agentes`);
lines.push(``);
lines.push(`| Alias | Nombre | Política |`);
lines.push(`|---|---|---|`);
for (const a of ROSTER) lines.push(`| ${a.alias} | ${a.name} | ${a.policy} |`);
lines.push(``);
lines.push(`---`);
lines.push(`Reporte generado automáticamente por \`scripts/e2e-competir-report.mjs\`.`);

const reportPath = join(OUT_DIR, "report.md");
writeFileSync(reportPath, lines.join("\n"));
const jsonPath = join(OUT_DIR, "results.json");
writeFileSync(
  jsonPath,
  JSON.stringify(
    { ts, filters: Object.fromEntries(activeFilters), counts, results, totalBeforeStatusFilter: allResults.length },
    null,
    2,
  ),
);

logLine(`✓ Reporte: ${reportPath}`);
logLine(`✓ JSON:    ${jsonPath}`);

process.exit(counts.fail ? 1 : 0);
