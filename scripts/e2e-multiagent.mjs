#!/usr/bin/env node
// Runner principal del plan de pruebas E2E multiagente.
// Ejecuta todos los escenarios `auto` y `db-check`, marca los `manual` como
// pendientes y genera un reporte humano-leíble en /mnt/documents/.
//
// Uso:
//   node scripts/e2e-multiagent.mjs
//   FILTER=C-1 node scripts/e2e-multiagent.mjs   # solo IDs que matchean
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCENARIOS, summary } from "./e2e-multiagent/scenarios.mjs";
import { runAllAuto } from "./e2e-multiagent/handlers.mjs";
import { ROSTER, ROSTER_PADEL, logLine, initState } from "./e2e-multiagent/config.mjs";

const OUT_DIR = "/mnt/documents/e2e-multiagent";
mkdirSync(OUT_DIR, { recursive: true });

await initState();

const filter = process.env.FILTER ?? "";
const scenarios = filter ? SCENARIOS.filter((s) => s.id.includes(filter)) : SCENARIOS;


logLine(`▶ Iniciando runner — ${scenarios.length} escenarios`);
logLine(`   Resumen catálogo:`, JSON.stringify(summary()));

const results = await runAllAuto(scenarios);

const counts = results.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
logLine(`◼ Resultados:`, JSON.stringify(counts));

// ─────────────────────────────────────────────────────────────────
// Reporte Markdown
// ─────────────────────────────────────────────────────────────────
const ts = new Date().toISOString();
const lines = [];
lines.push(`# Reporte E2E Multiagente — Competir + Torneos`);
lines.push(``);
lines.push(`Generado: \`${ts}\``);
lines.push(``);
lines.push(`## Roster`);
lines.push(``);
lines.push(`| Alias | Nombre | Política |`);
lines.push(`|---|---|---|`);
for (const a of ROSTER) lines.push(`| ${a.alias} | ${a.name} | ${a.policy} |`);
for (const a of ROSTER_PADEL) lines.push(`| ${a.alias} | ${a.name} | ${a.policy} (padel) |`);

lines.push(``);
lines.push(`## Resumen`);
lines.push(``);
lines.push(`- ✅ pass: **${counts.pass ?? 0}**`);
lines.push(`- ❌ fail: **${counts.fail ?? 0}**`);
lines.push(`- ⏭ skip: **${counts.skip ?? 0}**`);
lines.push(`- ✋ manual (requiere preview): **${counts.manual ?? 0}**`);
lines.push(``);

const byModule = results.reduce((acc, r) => {
  (acc[r.module] ??= []).push(r);
  return acc;
}, {});

for (const [mod, rows] of Object.entries(byModule)) {
  lines.push(`## ${mod}`);
  lines.push(``);
  lines.push(`| ID | Estado | Descripción | Agentes | Notas |`);
  lines.push(`|---|---|---|---|---|`);
  for (const r of rows) {
    const icon = { pass: "✅", fail: "❌", skip: "⏭", manual: "✋" }[r.status] ?? "❓";
    const note = r.error ?? (r.evidence?.note ?? (r.evidence ? JSON.stringify(r.evidence).slice(0, 90) : ""));
    lines.push(`| ${r.id} | ${icon} ${r.status} | ${r.desc} | ${r.agents.join(", ")} | ${note.replace(/\|/g, "\\|")} |`);
  }
  lines.push(``);
}

// ─────────────────────────────────────────────────────────────────
// Diagnóstico de fallos — adjunta evidencia completa de cada caso fail
// ─────────────────────────────────────────────────────────────────
const failed = results.filter((r) => r.status === "fail");
if (failed.length) {
  lines.push(`## ❌ Diagnóstico de fallos`);
  lines.push(``);
  lines.push(`Para cada escenario fallido se incluye el error y la evidencia (filas relacionadas, IDs huérfanos, etc.) tal como la devuelve el handler.`);
  lines.push(``);
  for (const r of failed) {
    lines.push(`### ${r.id} — ${r.desc}`);
    lines.push(``);
    lines.push(`- **Módulo:** ${r.module}`);
    lines.push(`- **Agentes:** ${r.agents.join(", ") || "—"}`);
    lines.push(`- **Error:** ${r.error ?? "(sin mensaje)"}`);
    if (r.evidence) {
      const ev = r.evidence;
      // Si trae IDs huérfanos los listamos primero, en bloque copy-paste-friendly
      if (Array.isArray(ev.orphan_ids) && ev.orphan_ids.length) {
        lines.push(``);
        lines.push(`- **\`challenge_id\` huérfanos (${ev.orphan_ids.length}):**`);
        lines.push(``);
        lines.push("```");
        for (const id of ev.orphan_ids) lines.push(id);
        lines.push("```");
      }
      lines.push(``);
      lines.push(`<details><summary>Evidencia completa</summary>`);
      lines.push(``);
      lines.push("```json");
      lines.push(JSON.stringify(ev, null, 2));
      lines.push("```");
      lines.push(``);
      lines.push(`</details>`);
    }
    lines.push(``);
  }
}


lines.push(`## Escenarios manuales — guía rápida para QA en preview`);
lines.push(``);
lines.push(`Loguearse en https://id-preview--6ca343ca-1653-481f-a874-c3ac334208aa.lovable.app con \`demouser@aceplay.cl\` (A1) o \`hectors42@gmail.com\` (A2) y validar:`);
lines.push(``);
for (const r of results.filter((x) => x.status === "manual")) {
  lines.push(`- **${r.id}** — ${r.desc} (agentes: ${r.agents.join(", ")})`);
}
lines.push(``);
lines.push(`---`);
lines.push(``);
lines.push(`Cobertura: **${counts.pass ?? 0}/${scenarios.length}** escenarios automatizados pasaron en este run.`);

const reportPath = join(OUT_DIR, "report.md");
writeFileSync(reportPath, lines.join("\n"));
const jsonPath = join(OUT_DIR, "results.json");
writeFileSync(jsonPath, JSON.stringify({ ts, counts, results }, null, 2));

logLine(`✓ Reporte: ${reportPath}`);
logLine(`✓ JSON:    ${jsonPath}`);

process.exit(counts.fail ? 1 : 0);
