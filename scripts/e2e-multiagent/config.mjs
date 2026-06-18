// Configuración compartida del runner multiagente E2E.
// IDs y rosters se resuelven dinámicamente vía initState() porque cambian en
// cada re-seed. Los handlers importan estos bindings (export let → ESM live
// bindings) y reciben los valores frescos tras initState().
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
export const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno");
}

export const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Live bindings (se sobrescriben en initState) ────────────────────
export let TENANT_ID = "";
export let LADDER_ID = "";          // ladder tenis singles activo
export let LADDER_PADEL_ID = "";    // La Pirámide Pádel
export let TOURNAMENT_ID = "";      // torneo tenis activo principal
export let TOURNAMENT_PADEL_ID = ""; // Open Pádel Stade
export let ROSTER = [];             // tenis
export let ROSTER_PADEL = [];       // pádel

export const POLICIES = {
  eager_acceptor:  { acceptPct: 0.95, rejectPct: 0.02, expirePct: 0.03 },
  challenger_up:   { acceptPct: 0.70, rejectPct: 0.10, expirePct: 0.10, challengePct: 0.6 },
  defender_top:    { acceptPct: 0.85, rejectPct: 0.10, expirePct: 0.05 },
  canceler:        { acceptPct: 0.40, rejectPct: 0.20, expirePct: 0.10, cancelPct: 0.3 },
  expirer:         { acceptPct: 0.20, rejectPct: 0.10, expirePct: 0.65 },
  doubles_player:  { acceptPct: 0.80, rejectPct: 0.10, expirePct: 0.10 },
  walkover_giver:  { acceptPct: 0.50, rejectPct: 0.15, expirePct: 0.10, walkoverPct: 0.40 },
  injury_quitter:  { acceptPct: 0.80, rejectPct: 0.05, expirePct: 0.05, retirePct: 0.5 },
  admin:           { acceptPct: 1.0, rejectPct: 0, expirePct: 0 },
};

// Mapping declarativo: alias → email + policy. Los user_ids se resuelven en initState.
const ROSTER_TENIS_SPEC = [
  { alias: "A1",  email: "demouser@aceplay.cl",  policy: "eager_acceptor",  name: "Demo User" },
  { alias: "A2",  email: "hectors42@gmail.com",  policy: "challenger_up",   name: "Héctor Smith" },
  { alias: "A3",  email: "socio01@stade.demo",   policy: "defender_top",    name: "Socio 01" },
  { alias: "A4",  email: "socio02@stade.demo",   policy: "challenger_up",   name: "Socio 02" },
  { alias: "A5",  email: "socio03@stade.demo",   policy: "canceler",        name: "Socio 03" },
  { alias: "A6",  email: "socio04@stade.demo",   policy: "expirer",         name: "Socio 04" },
  { alias: "A7",  email: "socio05@stade.demo",   policy: "doubles_player",  name: "Socio 05" },
  { alias: "A8",  email: "socio06@stade.demo",   policy: "doubles_player",  name: "Socio 06" },
  { alias: "A9",  email: "socio07@stade.demo",   policy: "challenger_up",   name: "Socio 07" },
  { alias: "A10", email: "socio08@stade.demo",   policy: "walkover_giver",  name: "Socio 08" },
  { alias: "A11", email: "socio09@stade.demo",   policy: "injury_quitter",  name: "Socio 09" },
  { alias: "A12", email: "admin@aceplay.cl",     policy: "admin",           name: "Admin Stade" },
];

const ROSTER_PADEL_SPEC = [
  { alias: "P1", email: "padel-demo@aceplay.cl",     policy: "eager_acceptor", name: "Padel Demo" },
  { alias: "P2", email: "padel-hector@aceplay.cl",   policy: "challenger_up",  name: "Padel Héctor" },
  { alias: "P3", email: "padel-socio01@aceplay.cl",  policy: "defender_top",   name: "Padel Socio 01" },
  { alias: "P4", email: "padel-socio02@aceplay.cl",  policy: "challenger_up",  name: "Padel Socio 02" },
  { alias: "P5", email: "padel-socio03@aceplay.cl",  policy: "doubles_player", name: "Padel Socio 03" },
  { alias: "P6", email: "padel-socio04@aceplay.cl",  policy: "doubles_player", name: "Padel Socio 04" },
  { alias: "P7", email: "padel-socio05@aceplay.cl",  policy: "walkover_giver", name: "Padel Socio 05" },
  { alias: "P8", email: "padel-socio06@aceplay.cl",  policy: "expirer",        name: "Padel Socio 06" },
];

export function findAgent(alias) {
  return ROSTER.find((a) => a.alias === alias) || ROSTER_PADEL.find((a) => a.alias === alias);
}

export function logLine(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

// ─── Resolución dinámica desde BD ──────────────────────────────────
export async function initState() {
  const TENANT_SLUG = "stade-frances";
  const { data: tenant, error: tErr } = await admin
    .from("tenants").select("id").eq("slug", TENANT_SLUG).single();
  if (tErr || !tenant) throw new Error(`No se encontró tenant '${TENANT_SLUG}': ${tErr?.message}`);
  TENANT_ID = tenant.id;

  const { data: ladders } = await admin
    .from("ladders").select("id, discipline, name, is_active").eq("tenant_id", TENANT_ID);
  const tenisLadder = (ladders ?? []).find((l) => l.discipline === "tenis_singles" && l.is_active);
  const padelLadder = (ladders ?? []).find((l) => l.discipline === "padel_dobles" && l.is_active);
  LADDER_ID = tenisLadder?.id ?? "";
  LADDER_PADEL_ID = padelLadder?.id ?? "";

  const { data: tournaments } = await admin
    .from("tournaments").select("id, name, slug").eq("tenant_id", TENANT_ID);
  TOURNAMENT_ID = (tournaments ?? []).find((t) => /grandstade.*verano|open stade/i.test(t.name))?.id ?? "";
  TOURNAMENT_PADEL_ID = (tournaments ?? []).find((t) => /open pádel|padel/i.test(t.name))?.id ?? "";

  // Resolver user_ids por email
  const allEmails = [...ROSTER_TENIS_SPEC, ...ROSTER_PADEL_SPEC].map((s) => s.email);
  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, email")
    .eq("tenant_id", TENANT_ID)
    .in("email", allEmails);
  const byEmail = new Map((profiles ?? []).map((p) => [p.email, p.user_id]));

  ROSTER = ROSTER_TENIS_SPEC
    .map((s) => ({ ...s, userId: byEmail.get(s.email) ?? null }))
    .filter((a) => a.userId);
  ROSTER_PADEL = ROSTER_PADEL_SPEC
    .map((s) => ({ ...s, userId: byEmail.get(s.email) ?? null }))
    .filter((a) => a.userId);

  const missingT = ROSTER_TENIS_SPEC.length - ROSTER.length;
  const missingP = ROSTER_PADEL_SPEC.length - ROSTER_PADEL.length;
  logLine(`initState: tenant=${TENANT_ID.slice(0,8)} ladder=${LADDER_ID.slice(0,8)} padelLadder=${LADDER_PADEL_ID.slice(0,8)} roster=${ROSTER.length}/${ROSTER_TENIS_SPEC.length} padelRoster=${ROSTER_PADEL.length}/${ROSTER_PADEL_SPEC.length}`);
  if (missingT || missingP) {
    logLine(`⚠ Agentes sin resolver — tenis:${missingT} padel:${missingP}. Re-correr seed-stade-demo si es necesario.`);
  }

  return { TENANT_ID, LADDER_ID, LADDER_PADEL_ID, TOURNAMENT_ID, TOURNAMENT_PADEL_ID, ROSTER, ROSTER_PADEL };
}
