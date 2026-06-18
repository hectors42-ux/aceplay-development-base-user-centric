#!/usr/bin/env node
// Construye un resumen Markdown compacto del reporte Competir para publicar
// como comentario de PR / job summary cuando termina la suite.
//
// Uso:
//   node scripts/e2e-competir-publish-summary.mjs <results.json> [out.md]
//
// Variables opcionales (enriquecen los enlaces de evidencia):
//   ARTIFACT_URL    URL del artifact `e2e-competir-report` en el run actual
//   RUN_URL         URL del workflow run
//   COMMIT_SHA      SHA corto para mostrar
//   APP_QA_URL      URL pública del dashboard /admin/qa/competir
import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outPath] = process.argv;
if (!inPath) {
  console.error("usage: publish-summary <results.json> [out.md]");
  process.exit(2);
}
const data = JSON.parse(readFileSync(inPath, "utf8"));
const { ts, counts = {}, results = [] } = data;
const total = results.length;
const auto = results.filter((r) => r.status !== "manual").length;
const passRate = auto ? Math.round(((counts.pass ?? 0) / auto) * 100) : 0;

const ARTIFACT_URL = process.env.ARTIFACT_URL ?? "";
const RUN_URL = process.env.RUN_URL ?? "";
const COMMIT_SHA = process.env.COMMIT_SHA ?? "";
const APP_QA_URL = process.env.APP_QA_URL ?? "";

const icon = { pass: "✅", fail: "❌", skip: "⏭", manual: "✋" };

const byModule = results.reduce((acc, r) => {
  const m = (acc[r.module] ??= { pass: 0, fail: 0, skip: 0, manual: 0, items: [] });
  m[r.status] = (m[r.status] ?? 0) + 1;
  m.items.push(r);
  return acc;
}, {});

const fails = results.filter((r) => r.status === "fail");

const lines = [];
lines.push(`<!-- e2e-competir-summary -->`);
lines.push(`### 🧪 Reporte E2E Competir`);
lines.push(``);
lines.push(
  `Generado: \`${new Date(ts).toISOString()}\`` +
    (COMMIT_SHA ? ` · commit \`${COMMIT_SHA}\`` : ""),
);
lines.push(``);
lines.push(`| ✅ pass | ❌ fail | ✋ manual | ⏭ skip | Tasa auto |`);
lines.push(`|---|---|---|---|---|`);
lines.push(
  `| **${counts.pass ?? 0}** | **${counts.fail ?? 0}** | ${counts.manual ?? 0} | ${counts.skip ?? 0} | **${passRate}%** (${counts.pass ?? 0}/${auto}) |`,
);
lines.push(``);

lines.push(`#### Por módulo`);
lines.push(``);
lines.push(`| Módulo | ✅ | ❌ | ✋ | ⏭ |`);
lines.push(`|---|---:|---:|---:|---:|`);
for (const [mod, c] of Object.entries(byModule)) {
  lines.push(`| \`${mod}\` | ${c.pass ?? 0} | ${c.fail ?? 0} | ${c.manual ?? 0} | ${c.skip ?? 0} |`);
}
lines.push(``);

if (fails.length) {
  lines.push(`#### ❌ Fallidos (${fails.length})`);
  lines.push(``);
  for (const f of fails) {
    const err = (f.error ?? "").toString().replace(/`/g, "'").slice(0, 200);
    lines.push(`- **${f.id}** — ${f.desc}${err ? ` · \`${err}\`` : ""}`);
  }
  lines.push(``);
}

lines.push(`#### 📎 Evidencia`);
lines.push(``);
if (ARTIFACT_URL) lines.push(`- 📦 [Artifact \`e2e-competir-report\` (report.md + results.json)](${ARTIFACT_URL})`);
if (RUN_URL) lines.push(`- 🛠️ [Workflow run](${RUN_URL})`);
if (APP_QA_URL) lines.push(`- 📊 [Dashboard QA en la app](${APP_QA_URL})`);
lines.push(`- Total escenarios: **${total}**`);
lines.push(``);
lines.push(`<sub>Comentario actualizado automáticamente por el workflow \`E2E Competir Report\`.</sub>`);

const md = lines.join("\n");
if (outPath) writeFileSync(outPath, md);
else process.stdout.write(md);
