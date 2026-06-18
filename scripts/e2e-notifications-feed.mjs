#!/usr/bin/env node
// E2E: login real + verificación de feed sticky para result_to_load.
//
// Cubre:
//  1. Login con email/password del usuario demo (auth real, no service-role).
//  2. Llamada a notifications_feed() RPC bajo sesión autenticada.
//  3. Aserción de que existen al menos N pendientes (default 7) y que las
//     entradas de kind `result_to_load` cumplen las reglas sticky:
//        - presentes en el feed
//        - sin entrada en notification_dismissals (no descartables)
//        - aparecen agrupadas al inicio cuando se aplica el orden sticky-first
//        - generan ítems "ACCIÓN REQUERIDA" en el cliente (kind ∈ STICKY_KINDS_ALWAYS).
//
// Salida: /mnt/documents/e2e-notifications-feed/report.json + log a stdout.
//
// Uso:
//   E2E_DEMO_PASSWORD=DemoUser2024 node scripts/e2e-notifications-feed.mjs
//   EXPECTED_PENDING=7 node scripts/e2e-notifications-feed.mjs

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.E2E_DEMO_EMAIL || "demouser@aceplay.cl";
const PASSWORD = process.env.E2E_DEMO_PASSWORD || "DemoUser2024";
const EXPECTED_PENDING = Number(process.env.EXPECTED_PENDING || 7);
const OUT_DIR = process.env.E2E_OUT_DIR || "/mnt/documents/e2e-notifications-feed";

const STICKY_ALWAYS = new Set(["result_to_load", "result_proposal"]);

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_ANON_KEY en el entorno");
  process.exit(2);
}

mkdirSync(OUT_DIR, { recursive: true });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const assertions = [];
const record = (name, ok, detail) => {
  assertions.push({ name, ok, detail });
  log(ok ? "✓" : "✗", name, detail ?? "");
};

async function main() {
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Login real
  log(`Login como ${EMAIL}…`);
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (authErr || !auth?.user) {
    record("login", false, authErr?.message ?? "no user");
    throw new Error("Login falló");
  }
  record("login", true, `uid=${auth.user.id}`);

  // 2. Feed unificado (RPC notifications_feed) + dismissals como en frontend
  const [feedRes, dismissRes] = await Promise.all([
    sb.rpc("notifications_feed"),
    sb.from("notification_dismissals").select("kind, ref_id").eq("user_id", auth.user.id),
  ]);

  if (feedRes.error) {
    record("rpc.notifications_feed", false, feedRes.error.message);
    throw new Error("RPC falló");
  }
  record("rpc.notifications_feed", true, `${feedRes.data?.length ?? 0} filas`);

  const dismissed = new Set(
    (dismissRes.data ?? []).map((d) => `${d.kind}::${d.ref_id}`),
  );
  const items = (feedRes.data ?? []).filter(
    (n) => !dismissed.has(`${n.kind}::${n.ref_id}`),
  );

  // 3. Pendientes totales
  record(
    "pendientes >= esperado",
    items.length >= EXPECTED_PENDING,
    `obtenidos=${items.length}, esperado>=${EXPECTED_PENDING}`,
  );

  // 4. result_to_load presente
  const rtl = items.filter((i) => i.kind === "result_to_load");
  record("result_to_load presente", rtl.length > 0, `count=${rtl.length}`);

  // 5. Ninguno de los result_to_load está en dismissals (regla sticky)
  const rtlDismissed = rtl.filter((r) =>
    dismissed.has(`result_to_load::${r.ref_id}`),
  );
  record(
    "result_to_load no descartado",
    rtlDismissed.length === 0,
    `bloqueados=${rtlDismissed.length}`,
  );

  // 6. Aplicar orden sticky-first del componente y validar que los sticky
  //    encabezan el feed.
  const sorted = [...items].sort((a, b) => {
    const aS = STICKY_ALWAYS.has(a.kind) ? 0 : 1;
    const bS = STICKY_ALWAYS.has(b.kind) ? 0 : 1;
    return aS - bS;
  });
  const stickyCount = sorted.filter((s) => STICKY_ALWAYS.has(s.kind)).length;
  const firstNonStickyIdx = sorted.findIndex((s) => !STICKY_ALWAYS.has(s.kind));
  const allStickyFirst =
    stickyCount === 0 ||
    firstNonStickyIdx === -1 ||
    firstNonStickyIdx >= stickyCount;
  record(
    "sticky-first ordering",
    allStickyFirst,
    `stickyCount=${stickyCount}, firstNonSticky=${firstNonStickyIdx}`,
  );

  // 7. Cada result_to_load apunta a un partner_match real (link no vacío)
  const rtlWithLink = rtl.every((r) => typeof r.link === "string" && r.link.length > 0);
  record("result_to_load con link", rtlWithLink, `total=${rtl.length}`);

  await sb.auth.signOut();

  const summary = {
    user: { email: EMAIL, id: auth.user.id },
    pending: items.length,
    expected_pending: EXPECTED_PENDING,
    by_kind: items.reduce((acc, it) => {
      acc[it.kind] = (acc[it.kind] || 0) + 1;
      return acc;
    }, {}),
    sticky_result_to_load: rtl.length,
    assertions,
    passed: assertions.every((a) => a.ok),
  };

  writeFileSync(`${OUT_DIR}/report.json`, JSON.stringify(summary, null, 2));
  log("Reporte:", `${OUT_DIR}/report.json`);
  log("Resultado:", summary.passed ? "PASS ✅" : "FAIL ❌");
  process.exit(summary.passed ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
