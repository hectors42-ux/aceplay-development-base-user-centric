#!/usr/bin/env node
/**
 * E2E /admin/analytics — recorre las 8 vistas y aplica aserciones estrictas:
 *  - Cada KPI numérico debe ser un número finito (no null/NaN/undefined).
 *  - Al menos 1 KPI por vista debe ser > 0 (no-cero).
 *  - Cada tabla/lista debe tener filas (no-vacía) — salvo casos esperados.
 *
 * Evidencia (cuando hay fallos):
 *  - /mnt/documents/analytics-e2e/evidence/<slug>.payload.json  → respuesta RPC cruda
 *  - /mnt/documents/analytics-e2e/evidence/<slug>.failures.json → lista de aserciones fallidas
 *  - /mnt/documents/analytics-e2e/summary.json                  → resumen máquina-leíble
 *  - /mnt/documents/analytics-e2e/report.md                     → resumen humano-leíble
 *  - /mnt/documents/analytics-e2e/screenshots-todo.json         → URLs a capturar por viewport
 *
 * Las screenshots se toman aparte (browser tools del agente) leyendo screenshots-todo.json.
 *
 * Uso:
 *   node scripts/e2e-analytics.mjs              # rango con datos (PASS esperado)
 *   FORCE_EMPTY_RANGE=1 node scripts/e2e-analytics.mjs   # demuestra evidencia de FAIL
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const PREVIEW_BASE = process.env.PREVIEW_URL || "https://id-preview--6ca343ca-1653-481f-a874-c3ac334208aa.lovable.app";
const OUT_DIR = process.env.OUT_DIR || "/mnt/documents/analytics-e2e";
const EVIDENCE_DIR = join(OUT_DIR, "evidence");

if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) {
  console.error("❌ Faltan SUPABASE_URL / SERVICE_ROLE / ANON keys en el entorno.");
  process.exit(2);
}

const TEST_USER_EMAIL = "hectors42@gmail.com";
const NOW = new Date();
const EMPTY = process.env.FORCE_EMPTY_RANGE === "1";
const FROM = new Date(NOW);
const TO = new Date(NOW);
if (EMPTY) { FROM.setFullYear(FROM.getFullYear() + 5); TO.setFullYear(TO.getFullYear() + 5); TO.setDate(TO.getDate() + 1); }
else { FROM.setDate(FROM.getDate() - 30); TO.setDate(TO.getDate() + 1); }

const C = { red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m", dim: "\x1b[2m", bold: "\x1b[1m", reset: "\x1b[0m" };

// ---------- aserciones ----------
function isNumericish(v) { return v !== null && v !== undefined && Number.isFinite(Number(v)); }
function assertNumericKpi(name, val, fails, { allowZero = false } = {}) {
  if (val === null || val === undefined) { fails.push(`KPI "${name}" está vacío (null/undefined) → renderizaría "—"`); return false; }
  if (!Number.isFinite(Number(val))) { fails.push(`KPI "${name}" no es numérico (${JSON.stringify(val)})`); return false; }
  if (!allowZero && Number(val) === 0) { fails.push(`KPI "${name}" = 0 (esperado > 0)`); return false; }
  return true;
}
function assertNonEmptyArray(name, arr, fails) {
  if (!Array.isArray(arr)) { fails.push(`Tabla "${name}" no es un array (${typeof arr})`); return false; }
  if (arr.length === 0) { fails.push(`Tabla "${name}" está vacía → renderizaría "Sin datos"`); return false; }
  return true;
}
function assertAtLeastOneNonZero(label, values, fails) {
  const some = values.some((v) => Number.isFinite(Number(v)) && Number(v) > 0);
  if (!some) fails.push(`${label}: todos los valores son 0/vacíos → vista parecería sin datos`);
  return some;
}

// ---------- specs de vistas ----------
function buildSpecs(FROM_ISO, TO_ISO, monthStr) {
  return [
    {
      slug: "resumen", title: "Resumen", path: "/admin/analytics",
      rpc: "analytics_overview", args: { p_from: FROM_ISO, p_to: TO_ISO },
      validate(data, fails) {
        assertNumericKpi("occupancy_pct", data.occupancy_pct, fails, { allowZero: true });
        assertNumericKpi("active_members_30d", data.active_members_30d, fails);
        assertNumericKpi("clases_revenue_clp", data.clases_revenue_clp, fails);
        assertNumericKpi("health_score", data.health_score, fails);
        if (assertNonEmptyArray("top_coaches", data.top_coaches, fails))
          assertAtLeastOneNonZero("top_coaches.revenue", data.top_coaches.map((c) => c.revenue), fails);
        assertAtLeastOneNonZero("Resumen KPIs principales",
          [data.occupancy_pct, data.active_members_30d, data.clases_revenue_clp, data.matches_played_week], fails);
      },
    },
    {
      slug: "operacion", title: "Operación", path: "/admin/analytics/operacion",
      rpc: "analytics_occupancy_heatmap", args: { p_from: FROM_ISO, p_to: TO_ISO },
      validate(data, fails) {
        if (assertNonEmptyArray("heatmap cells", data, fails))
          assertAtLeastOneNonZero("heatmap.occupied_count", data.map((c) => c.occupied_count), fails);
      },
    },
    {
      slug: "finanzas", title: "Finanzas", path: "/admin/analytics/finanzas",
      rpc: "analytics_finance_summary", args: { p_from: FROM_ISO, p_to: TO_ISO },
      validate(data, fails) {
        assertNumericKpi("clases_revenue_clp", data.clases_revenue_clp, fails);
        assertNumericKpi("morosos_total", data.morosos_total, fails, { allowZero: true });
        ["morosos_30d", "morosos_60d", "morosos_90d"].forEach((k) => assertNumericKpi(k, data[k], fails, { allowZero: true }));
        if (assertNonEmptyArray("revenue_by_day", data.revenue_by_day, fails))
          assertAtLeastOneNonZero("revenue_by_day.clases", data.revenue_by_day.map((d) => d.clases), fails);
      },
    },
    {
      slug: "coaches", title: "Coaches", path: "/admin/analytics/coaches",
      rpc: "analytics_coaches_performance", args: { p_from: FROM_ISO, p_to: TO_ISO },
      validate(data, fails) {
        const list = (data && data.coaches) || [];
        if (assertNonEmptyArray("coaches", list, fails)) {
          assertAtLeastOneNonZero("coaches.classes", list.map((c) => c.classes), fails);
          assertAtLeastOneNonZero("coaches.revenue_clp", list.map((c) => c.revenue_clp), fails);
          for (const c of list) {
            if (!c.name || String(c.name).trim() === "") fails.push(`Coach ${c.coach_id} sin nombre`);
          }
        }
      },
    },
    {
      slug: "socios", title: "Socios", path: "/admin/analytics/socios",
      rpc: "analytics_members_engagement", args: { p_from: FROM_ISO, p_to: TO_ISO },
      validate(data, fails) {
        assertNumericKpi("total_members", data.total_members, fails);
        assertNumericKpi("avg_bookings_per_member", data.avg_bookings_per_member, fails);
        const dist = data.distribution || {};
        ["A", "B", "C", "sin_rating"].forEach((k) => {
          if (!isNumericish(dist[k])) fails.push(`distribution.${k} no es numérico (${JSON.stringify(dist[k])})`);
        });
        assertAtLeastOneNonZero("distribution A/B/C", [dist.A, dist.B, dist.C], fails);
        if (assertNonEmptyArray("stars", data.stars, fails))
          assertAtLeastOneNonZero("stars.bookings_count", data.stars.map((s) => s.bookings_count), fails);
        const f = data.challenge_funnel || {};
        ["enviados", "aceptados", "jugados"].forEach((k) => {
          if (!isNumericish(f[k])) fails.push(`challenge_funnel.${k} no es numérico`);
        });
        assertAtLeastOneNonZero("challenge_funnel", [f.enviados, f.aceptados, f.jugados], fails);
        if (!Array.isArray(data.at_risk)) fails.push(`at_risk no es array`);
      },
    },
    {
      slug: "comunidad", title: "Comunidad", path: "/admin/analytics/comunidad",
      rpc: "analytics_community_stats", args: { p_from: FROM_ISO, p_to: TO_ISO },
      validate(data, fails) {
        ["avg_accept_hours", "avg_play_hours"].forEach((k) => assertNumericKpi(k, data[k], fails, { allowZero: true }));
        if (assertNonEmptyArray("active_ladders", data.active_ladders, fails))
          assertAtLeastOneNonZero("active_ladders.matches", data.active_ladders.map((l) => l.matches), fails);
        if (!Array.isArray(data.top_progress)) fails.push("top_progress no es array");
        if (!Array.isArray(data.top_decline)) fails.push("top_decline no es array");
        if (!Array.isArray(data.level_density)) fails.push("level_density no es array");
      },
    },
    {
      slug: "alertas", title: "Alertas", path: "/admin/analytics/alertas",
      rpc: "analytics_alerts", args: undefined,
      validate(data, fails) {
        if (!Array.isArray(data)) { fails.push(`analytics_alerts no devolvió array (${typeof data})`); return; }
        for (const a of data) {
          if (!a.kind || !["critical", "opportunity"].includes(a.kind)) fails.push(`alerta con kind inválido: ${JSON.stringify(a.kind)}`);
          if (!a.title || String(a.title).trim() === "") fails.push(`alerta sin title`);
          if (!a.body || String(a.body).trim() === "") fails.push(`alerta "${a.title}" sin body`);
        }
      },
    },
    {
      slug: "directorio", title: "Directorio", path: "/admin/analytics/directorio",
      rpc: "analytics_directory_digest", args: { p_month: monthStr },
      skipOnPermissionError: true,
      validate(data, fails) {
        const ov = data.overview || {};
        assertNumericKpi("overview.health_score", ov.health_score, fails, { allowZero: true });
        assertNumericKpi("overview.active_members_30d", ov.active_members_30d, fails);
        if (!Array.isArray(data.wins)) fails.push("wins no es array");
        if (!Array.isArray(data.risks)) fails.push("risks no es array");
      },
    },
  ];
}

// ---------- main ----------
async function main() {
  // Reset solo de archivos de datos (preserva screenshots/ entre corridas)
  if (existsSync(EVIDENCE_DIR)) rmSync(EVIDENCE_DIR, { recursive: true, force: true });
  for (const f of ["summary.json", "report.md", "screenshots-todo.json"]) {
    const p = join(OUT_DIR, f);
    if (existsSync(p)) rmSync(p, { force: true });
  }
  mkdirSync(EVIDENCE_DIR, { recursive: true });

  console.log(`${C.cyan}→ Generando sesión para ${TEST_USER_EMAIL}...${C.reset}`);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: TEST_USER_EMAIL });
  if (linkErr) { console.error("generateLink error", linkErr); process.exit(2); }
  const hashedToken = link.properties?.hashed_token;
  if (!hashedToken) { console.error("❌ No se obtuvo hashed_token"); process.exit(2); }

  const userClient = createClient(SUPABASE_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: verified, error: verifyErr } = await userClient.auth.verifyOtp({ type: "magiclink", token_hash: hashedToken });
  if (verifyErr || !verified.session) { console.error("❌ verifyOtp falló", verifyErr); process.exit(2); }
  console.log(`${C.green}✓ Sesión activa como ${verified.user.email}${C.reset}`);

  const FROM_ISO = FROM.toISOString();
  const TO_ISO = TO.toISOString();
  const monthStr = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}-01`;
  const specs = buildSpecs(FROM_ISO, TO_ISO, monthStr);

  const results = [];
  for (const spec of specs) {
    const fails = [];
    let payload = null;
    let rpcError = null;
    let skipped = false;

    const t0 = Date.now();
    const { data, error } = await userClient.rpc(spec.rpc, spec.args);
    const elapsedMs = Date.now() - t0;

    if (error) {
      rpcError = { message: error.message, code: error.code, details: error.details };
      const msg = (error.message || "").toLowerCase();
      if (spec.skipOnPermissionError && (msg.includes("permission") || msg.includes("denied") || msg.includes("forbid") || msg.includes("super"))) {
        skipped = true;
      } else {
        fails.push(`RPC ${spec.rpc} falló: ${error.message}`);
      }
    } else if (data === null || data === undefined) {
      fails.push(`RPC ${spec.rpc} devolvió null/undefined`);
    } else {
      payload = data;
      try { spec.validate(data, fails); }
      catch (e) { fails.push(`Excepción en validate(): ${e.message}`); }
    }

    const ok = fails.length === 0;
    const tag = skipped ? `${C.yellow}⊘ SKIP${C.reset}` : ok ? `${C.green}✓ PASS${C.reset}` : `${C.red}✗ FAIL${C.reset}`;
    console.log(`\n${tag} ${C.bold}${spec.title}${C.reset}  ${C.dim}${spec.path} (${elapsedMs}ms)${C.reset}`);
    for (const f of fails) console.log(`   ${C.red}- ${f}${C.reset}`);
    if (skipped) console.log(`   ${C.dim}Restringido a super_admin (esperado)${C.reset}`);

    // Guardar evidencia SI hay fallo (no para PASS/SKIP)
    if (!ok && !skipped) {
      writeFileSync(
        join(EVIDENCE_DIR, `${spec.slug}.payload.json`),
        JSON.stringify({ rpc: spec.rpc, args: spec.args, elapsedMs, error: rpcError, payload }, null, 2),
      );
      writeFileSync(
        join(EVIDENCE_DIR, `${spec.slug}.failures.json`),
        JSON.stringify({ view: spec.title, path: spec.path, failures: fails }, null, 2),
      );
    }

    results.push({ slug: spec.slug, title: spec.title, path: spec.path, rpc: spec.rpc, ok, skipped, failures: fails, elapsedMs });
  }

  // ---------- summary.json ----------
  const passed = results.filter((r) => r.ok && !r.skipped).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.ok && !r.skipped).length;
  const failedViews = results.filter((r) => !r.ok && !r.skipped);

  const summary = {
    run_at: new Date().toISOString(),
    range: { from: FROM_ISO, to: TO_ISO, forced_empty: EMPTY },
    user: TEST_USER_EMAIL,
    totals: { passed, skipped: skippedCount, failed, total: results.length },
    results,
  };
  writeFileSync(join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));

  // ---------- screenshots-todo.json ----------
  // Pista para que el agente capture screenshots de las vistas FAIL en desktop+mobile
  const todo = {
    preview_base: PREVIEW_BASE,
    viewports: [
      { name: "desktop", width: 1280, height: 800 },
      { name: "mobile", width: 390, height: 844 },
    ],
    captures: failedViews.map((r) => ({
      slug: r.slug,
      title: r.title,
      url: PREVIEW_BASE + r.path,
      reason: `${r.failures.length} fallo(s)`,
    })),
  };
  writeFileSync(join(OUT_DIR, "screenshots-todo.json"), JSON.stringify(todo, null, 2));

  // ---------- report.md ----------
  const lines = [];
  lines.push(`# E2E /admin/analytics — Reporte`);
  lines.push("");
  lines.push(`- **Ejecutado:** ${summary.run_at}`);
  lines.push(`- **Usuario:** ${TEST_USER_EMAIL}`);
  lines.push(`- **Rango:** ${FROM_ISO} → ${TO_ISO}${EMPTY ? " _(forzado vacío)_" : ""}`);
  lines.push(`- **Resultado:** ✅ ${passed} PASS · ⊘ ${skippedCount} SKIP · ❌ ${failed} FAIL  (total ${results.length})`);
  lines.push("");
  lines.push(`| Vista | Estado | RPC | Tiempo | Fallos | Desktop | Mobile |`);
  lines.push(`|---|---|---|---:|---|---|---|`);
  for (const r of results) {
    const status = r.skipped ? "⊘ SKIP" : r.ok ? "✅ PASS" : "❌ FAIL";
    const desk = existsSync(join(OUT_DIR, "screenshots/desktop", `${r.slug}.png`)) ? `[📷](screenshots/desktop/${r.slug}.png)` : "—";
    const mob = existsSync(join(OUT_DIR, "screenshots/mobile", `${r.slug}.png`)) ? `[📷](screenshots/mobile/${r.slug}.png)` : "—";
    lines.push(`| **${r.title}** \`${r.path}\` | ${status} | \`${r.rpc}\` | ${r.elapsedMs}ms | ${r.failures.length} | ${desk} | ${mob} |`);
  }
  if (failedViews.length > 0) {
    lines.push("");
    lines.push(`## Detalles de fallos`);
    for (const r of failedViews) {
      lines.push("");
      lines.push(`### ❌ ${r.title} — \`${r.path}\``);
      lines.push(`- RPC: \`${r.rpc}\``);
      lines.push(`- Evidencia datos: \`evidence/${r.slug}.payload.json\` · \`evidence/${r.slug}.failures.json\``);
      const deskOk = existsSync(join(OUT_DIR, "screenshots/desktop", `${r.slug}.png`));
      const mobOk = existsSync(join(OUT_DIR, "screenshots/mobile", `${r.slug}.png`));
      if (deskOk || mobOk) {
        lines.push(`- Screenshots: ${deskOk ? `\`screenshots/desktop/${r.slug}.png\`` : "_desktop pendiente_"} · ${mobOk ? `\`screenshots/mobile/${r.slug}.png\`` : "_mobile pendiente_"}`);
      } else {
        lines.push(`- Screenshots: pendientes (ver \`screenshots-todo.json\`)`);
      }
      lines.push("");
      lines.push(`**Aserciones falladas:**`);
      for (const f of r.failures) lines.push(`- ${f}`);
    }
    lines.push("");
    lines.push(`## Cómo capturar screenshots de vistas con fallo`);
    lines.push(`Las URLs y viewports están en \`screenshots-todo.json\`. Capturarlas con el navegador headless del agente (autenticado como Héctor) y guardarlas en \`screenshots/<viewport>/<slug>.png\`. Esta corrida ${failedViews.length === 0 ? "no requirió capturas" : `dejó ${failedViews.length} vista(s) por documentar`}.`);
  }
  writeFileSync(join(OUT_DIR, "report.md"), lines.join("\n"));

  // ---------- consola final ----------
  console.log(`\n${C.bold}════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  REPORTE E2E /admin/analytics${C.reset}`);
  console.log(`${C.bold}════════════════════════════════════════════${C.reset}`);
  console.log(`${C.green}PASS: ${passed}${C.reset}   ${C.yellow}SKIP: ${skippedCount}${C.reset}   ${C.red}FAIL: ${failed}${C.reset}   (total: ${results.length})`);
  for (const r of results) {
    const tag = r.skipped ? `${C.yellow}⊘${C.reset}` : r.ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
    console.log(`  ${tag} ${r.title}${r.failures.length ? ` — ${r.failures.length} fallo(s)` : ""}`);
  }
  console.log(`\n${C.dim}Evidencia → ${OUT_DIR}/${C.reset}`);
  console.log(`${C.dim}  · summary.json · report.md · screenshots-todo.json · evidence/*.json${C.reset}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("💥 Error fatal:", e); process.exit(2); });
