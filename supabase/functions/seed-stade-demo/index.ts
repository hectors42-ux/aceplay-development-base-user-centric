// Seed completo del tenant Stade Français con datos demo ricos.
// Idempotente: borra el tenant si existe y los usuarios auth conocidos, luego recrea todo.
// Llamar con: curl -X POST <fn-url> con header x-seed-key = SEED_KEY (o sin auth si verify_jwt=false).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-seed-key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const TENANT_SLUG = "stade-frances";

// --- Catálogo de socios sembrados (47 socios + admin + demouser = 49 creados por la función;
// Héctor entra por Google y se le promueve a club_admin después) ---
const FIRST_NAMES_M = ["Mathieu", "Antoine", "Lucas", "Hugo", "Étienne", "Pierre", "Sébastien", "Nicolas", "Vincent", "Julien", "Cristóbal", "Tomás", "Felipe", "Diego", "Andrés", "Joaquín", "Matías", "Benjamín", "Vicente", "Agustín", "Rodrigo", "Sebastián", "Ignacio", "José"];
const FIRST_NAMES_F = ["Camille", "Sophie", "Léa", "Émilie", "Margaux", "Chloé", "Juliette", "Amélie", "Catalina", "Isidora", "Antonia", "Florencia", "Javiera", "Martina", "Sofía", "Constanza", "Trinidad", "Magdalena", "Renata", "Emilia", "Valentina", "Fernanda", "Amanda"];
const LAST_NAMES = ["Dupont", "Martin", "Bernard", "Petit", "Moreau", "Lefebvre", "Laurent", "González", "Errázuriz", "Vial", "Larraín", "Edwards", "Walker", "Subercaseaux", "Ossa", "Cousiño", "Matte", "Echeverría", "Valdés", "Irarrázaval", "Eyzaguirre", "Tagle", "Prieto", "Bulnes"];

type SeedUser = {
  email: string;
  password: string;
  first: string;
  last: string;
  gender: "M" | "F";
  ntrp: number;
  duesStatus: "al_dia" | "pendiente" | "moroso";
  role: "club_admin" | "member" | "coach";
};

function buildRoster(): SeedUser[] {
  const roster: SeedUser[] = [
    { email: "admin@aceplay.cl", password: "AdminUser2024", first: "Admin", last: "Stade", gender: "M", ntrp: 4.0, duesStatus: "al_dia", role: "club_admin" },
    { email: "demouser@aceplay.cl", password: "DemoUser2024", first: "Pierre", last: "Demo", gender: "M", ntrp: 3.5, duesStatus: "al_dia", role: "member" },
    { email: "hectors42@gmail.com", password: "Hector2024Demo", first: "Héctor", last: "Smith", gender: "M", ntrp: 3.5, duesStatus: "al_dia", role: "member" },
  ];
  // 3 coaches
  const coachNames = [["Bruno", "Lemaitre", "M"], ["Camille", "Bonnet", "F"], ["Rodrigo", "Vergara", "M"]] as const;
  for (let i = 0; i < coachNames.length; i++) {
    const [first, last, g] = coachNames[i];
    roster.push({
      email: `coach${i + 1}@aceplay.cl`, password: "CoachDemo2024",
      first, last, gender: g as "M" | "F", ntrp: 5.0, duesStatus: "al_dia", role: "coach",
    });
  }
  // 45 socios variados
  for (let i = 0; i < 45; i++) {
    const isF = i % 3 === 0;
    const first = isF
      ? FIRST_NAMES_F[i % FIRST_NAMES_F.length]
      : FIRST_NAMES_M[i % FIRST_NAMES_M.length];
    const last = LAST_NAMES[i % LAST_NAMES.length];
    const ntrp = 2.0 + Math.round((i * 0.13) % 3.0 * 10) / 10; // 2.0 - 5.0
    const dues = i % 11 === 0 ? "moroso" : i % 7 === 0 ? "pendiente" : "al_dia";
    roster.push({
      email: `socio${(i + 1).toString().padStart(2, "0")}@stade.demo`,
      password: "Socio2024Demo",
      first, last, gender: isF ? "F" : "M",
      ntrp, duesStatus: dues as any, role: "member",
    });
  }
  return roster;
}

async function wipeTenant() {
  // Borrar tenant Stade si existe — cascade limpia casi todo
  const { data: existing } = await admin.from("tenants").select("id").eq("slug", TENANT_SLUG).maybeSingle();
  if (existing) {
    // Borrar profiles antes (FK RESTRICT)
    await admin.from("profiles").delete().eq("tenant_id", existing.id);
    await admin.from("tenants").delete().eq("id", existing.id);
  }
  // Borrar usuarios auth conocidos por email (usa RPC SECURITY DEFINER porque
  // listUsers paginado se rompe con muchos usuarios).
  const roster = buildRoster();
  const emails = roster.map((u) => u.email.toLowerCase());
  const { data: foundUsers, error: lookupErr } = await admin
    .rpc("_e2e_lookup_users_by_email", { emails });
  if (lookupErr) {
    console.error("wipeTenant lookup:", lookupErr.message);
  } else {
    let totalDeleted = 0;
    for (const u of foundUsers ?? []) {
      const { error: dErr } = await admin.auth.admin.deleteUser(u.user_id);
      if (dErr) console.error("wipeTenant deleteUser failed:", u.email, dErr.message);
      else totalDeleted++;
    }
    console.log(`wipeTenant: ${totalDeleted}/${foundUsers?.length ?? 0} auth users deleted`);
  }
}

async function createTenant(): Promise<string> {
  const { data, error } = await admin.from("tenants").insert({
    slug: TENANT_SLUG,
    name: "Club Stade Français",
    short_name: "Stade",
    brand_primary: "230 100% 43%",
    brand_primary_glow: "230 95% 60%",
    brand_primary_deep: "230 85% 28%",
    timezone: "America/Santiago",
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function createUsers(tenantId: string, roster: SeedUser[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const u of roster) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: {
        first_name: u.first,
        last_name: u.last,
        tenant_id: tenantId,
      },
    });
    if (error) {
      console.error("createUser failed", u.email, error.message);
      continue;
    }
    map.set(u.email, data.user!.id);
  }
  return map;
}

async function configureProfilesAndRoles(tenantId: string, roster: SeedUser[], userIds: Map<string, string>) {
  const now = new Date().toISOString();
  // No existe trigger handle_new_user en auth.users en este entorno: insertamos perfiles y roles manualmente.
  const profileRows: any[] = [];
  const roleRows: any[] = [];
  for (const u of roster) {
    const uid = userIds.get(u.email);
    if (!uid) continue;
    profileRows.push({
      user_id: uid, tenant_id: tenantId, email: u.email,
      first_name: u.first, last_name: u.last,
      ntrp_level: u.ntrp, dues_status: u.duesStatus,
      phone: "+56 9 " + Math.floor(10000000 + Math.random() * 89999999),
      birth_date: `19${70 + Math.floor(Math.random() * 30)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`,
      accepted_terms_at: now, accepted_privacy_at: now,
      member_since: `20${(20 + Math.floor(Math.random() * 6)).toString()}-01-15`,
      favorite_surface: "arcilla", theme: "etat-francais", theme_mode: "light",
    });
    roleRows.push({ user_id: uid, tenant_id: tenantId, role: u.role === "coach" ? "member" : u.role });
    if (u.role === "coach") roleRows.push({ user_id: uid, tenant_id: tenantId, role: "coach" });
  }
  const { error: pErr } = await admin.from("profiles").insert(profileRows);
  if (pErr) console.error("profiles insert:", pErr.message);
  const { error: rErr } = await admin.from("user_roles").insert(roleRows);
  if (rErr) console.error("user_roles insert:", rErr.message);
}

async function seedClubConfig(tenantId: string) {
  // booking_rules ya se crea por trigger. analytics_thresholds y tenant_rating_config no.
  await admin.from("analytics_thresholds").insert({ tenant_id: tenantId }).then(() => {}).catch(() => {});
  await admin.from("tenant_rating_config").insert({ tenant_id: tenantId }).then(() => {}).catch(() => {});

  // Legal documents
  await admin.from("legal_documents").insert([
    { tenant_id: tenantId, kind: "terms", title: "Términos y Condiciones — Stade Français", content_md: "# Términos\n\nUso de la plataforma del Club Stade Français Tenis.", version: "1.0" },
    { tenant_id: tenantId, kind: "privacy", title: "Política de Privacidad", content_md: "# Privacidad\n\nProtegemos tus datos.", version: "1.0" },
    { tenant_id: tenantId, kind: "club_regulation", title: "Reglamento Interno del Club", content_md: "# Reglamento\n\nNormas de juego y convivencia.", version: "1.0" },
  ]);
}

async function seedCourts(tenantId: string): Promise<string[]> {
  const courts = Array.from({ length: 18 }, (_, i) => ({
    name: `Cancha ${i + 1}`,
    surface: "arcilla",
    sort_order: i + 1,
  }));
  const ids: string[] = [];
  for (const c of courts) {
    const { data } = await admin.from("courts").insert({ tenant_id: tenantId, ...c } as any).select("id").single();
    if (data) ids.push(data.id);
  }
  return ids;
}

async function seedRatings(tenantId: string, roster: SeedUser[], userIds: Map<string, string>) {
  const rows = roster.map((u) => {
    const uid = userIds.get(u.email);
    if (!uid) return null;
    return {
      tenant_id: tenantId,
      user_id: uid,
      sport: "tenis_singles",
      level: u.ntrp,
      initial_level: u.ntrp,
      reliability: 60 + Math.floor(Math.random() * 35),
      matches_played: 5 + Math.floor(Math.random() * 30),
      competitive_matches: 2 + Math.floor(Math.random() * 15),
      last_match_at: new Date(Date.now() - Math.random() * 60 * 24 * 3600 * 1000).toISOString(),
      onboarding_completed_at: new Date().toISOString(),
    };
  }).filter(Boolean);
  await admin.from("player_ratings").insert(rows as any);
}

async function seedBookings(tenantId: string, courtIds: string[], userIds: Map<string, string>, demoId: string) {
  const allIds = Array.from(userIds.values());
  const rows: any[] = [];
  // Pasadas (últimos 30 días)
  for (let d = 30; d >= 1; d--) {
    const day = new Date();
    day.setDate(day.getDate() - d);
    const numToday = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numToday; i++) {
      const hour = 8 + Math.floor(Math.random() * 13);
      const start = new Date(day); start.setHours(hour, 0, 0, 0);
      const end = new Date(start); end.setHours(hour + 1);
      const uid = allIds[Math.floor(Math.random() * allIds.length)];
      const partner = allIds[Math.floor(Math.random() * allIds.length)];
      rows.push({
        tenant_id: tenantId,
        court_id: courtIds[Math.floor(Math.random() * courtIds.length)],
        user_id: uid,
        partner_user_id: partner !== uid ? partner : null,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "confirmada",
        kind: "socio",
      });
    }
  }
  // Futuras: 1 para demouser mañana
  const tom = new Date(); tom.setDate(tom.getDate() + 1); tom.setHours(18, 0, 0, 0);
  const tomEnd = new Date(tom); tomEnd.setHours(19, 0, 0, 0);
  rows.push({
    tenant_id: tenantId, court_id: courtIds[0], user_id: demoId,
    partner_user_id: allIds.find((id) => id !== demoId),
    starts_at: tom.toISOString(), ends_at: tomEnd.toISOString(),
    status: "confirmada", kind: "socio",
  });
  // 7 futuras más
  for (let d = 2; d <= 8; d++) {
    const day = new Date(); day.setDate(day.getDate() + d);
    const hour = 9 + Math.floor(Math.random() * 12);
    day.setHours(hour, 0, 0, 0);
    const end = new Date(day); end.setHours(hour + 1);
    const uid = allIds[Math.floor(Math.random() * allIds.length)];
    rows.push({
      tenant_id: tenantId, court_id: courtIds[Math.floor(Math.random() * courtIds.length)],
      user_id: uid, starts_at: day.toISOString(), ends_at: end.toISOString(),
      status: "confirmada", kind: "socio",
    });
  }
  // Insert uno-a-uno para evitar que un choque por bookings_no_overlap rompa todo el batch
  let okCount = 0;
  for (const r of rows) {
    const { error } = await admin.from("bookings").insert(r);
    if (!error) okCount++;
  }
  console.log(`bookings: ${okCount}/${rows.length} insertadas`);
}

async function seedLadder(tenantId: string, roster: SeedUser[], userIds: Map<string, string>, demoId: string) {
  // Pirámide Verano 2026 — singles mixto
  const { data: ladder } = await admin.from("ladders").insert({
    tenant_id: tenantId,
    name: "Pirámide Verano 2026",
    description: "Pirámide oficial del club, temporada Verano 2026",
    discipline: "tenis_singles",
    gender: "mixto",
    surface: "arcilla",
    is_active: true,
    season_starts_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    season_ends_at: new Date(Date.now() + 60 * 86400000).toISOString(),
  }).select("id").single();
  if (!ladder) return;

  // 24 participantes — agentes E2E fijos (A1..A11) + relleno por NTRP
  // A2=Héctor en pos #6, A1=demouser en pos #11; A3..A11 = socio01..socio09 garantizados
  const E2E_AGENT_EMAILS = [
    "socio01@stade.demo", "socio02@stade.demo", "socio03@stade.demo",
    "socio04@stade.demo", "socio05@stade.demo", "socio06@stade.demo",
    "socio07@stade.demo", "socio08@stade.demo", "socio09@stade.demo",
  ];
  const FIXED_EMAILS = new Set<string>([
    "demouser@aceplay.cl", "hectors42@gmail.com", ...E2E_AGENT_EMAILS,
  ]);
  const candidates = roster.filter((u) => u.role !== "club_admin" && !FIXED_EMAILS.has(u.email));
  const fillerCount = 24 - 2 - E2E_AGENT_EMAILS.length; // 13 espacios
  const sorted = candidates.sort((a, b) => b.ntrp - a.ntrp).slice(0, fillerCount);
  const ladderUsers: { uid: string; email: string }[] = [];
  for (const u of sorted) ladderUsers.push({ uid: userIds.get(u.email)!, email: u.email });
  // Insertar A3..A11 al inicio (quedan en posiciones bajas) — luego A1/A2 se intercalan
  for (const email of E2E_AGENT_EMAILS) {
    const uid = userIds.get(email);
    if (uid) ladderUsers.unshift({ uid, email });
  }
  // Héctor (A2) en posición #6 (índice 5), demouser (A1) en posición #11 (índice 10)
  const hectorId = userIds.get("hectors42@gmail.com");
  if (hectorId) ladderUsers.splice(5, 0, { uid: hectorId, email: "hectors42@gmail.com" });
  ladderUsers.splice(10, 0, { uid: demoId, email: "demouser@aceplay.cl" });

  const positions = ladderUsers.map((u, idx) => ({
    ladder_id: ladder.id, tenant_id: tenantId, user_id: u.uid,
    position: idx + 1,
    status: "activo",
    wins: Math.floor(Math.random() * 6),
    losses: Math.floor(Math.random() * 4),
    last_played_at: new Date(Date.now() - Math.random() * 20 * 86400000).toISOString(),
    joined_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  }));
  await admin.from("ladder_positions").insert(positions);

  // ~15 desafíos
  const challenges: any[] = [];
  const statuses = ["jugado", "jugado", "jugado", "jugado", "programado", "aceptado", "propuesto", "propuesto"];
  for (let i = 0; i < 15; i++) {
    const challengerIdx = Math.floor(Math.random() * 22) + 2;
    const challengedIdx = challengerIdx - 1 - Math.floor(Math.random() * 2);
    if (challengedIdx < 1) continue;
    const challenger = ladderUsers[challengerIdx];
    const challenged = ladderUsers[challengedIdx];
    const status = statuses[i % statuses.length];
    const challengedAt = new Date(Date.now() - (15 - i) * 86400000).toISOString();
    const row: any = {
      ladder_id: ladder.id, tenant_id: tenantId,
      challenger_user_id: challenger.uid, challenged_user_id: challenged.uid,
      challenger_position: challengerIdx + 1, challenged_position: challengedIdx + 1,
      status,
      proposed_at: challengedAt,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    };
    if (status === "jugado") {
      const winner = Math.random() < 0.4 ? challenger : challenged;
      const loser = winner === challenger ? challenged : challenger;
      row.winner_user_id = winner.uid;
      row.loser_user_id = loser.uid;
      row.played_at = challengedAt;
      row.result_confirmed_at = challengedAt;
      row.score = { sets: [[6, 4], [3, 6], [7, 5]] };
    }
    challenges.push(row);
  }
  // Uno extra: demouser desafiado por #11 (pendiente)
  const demoPos = ladderUsers.findIndex((u) => u.uid === demoId);
  if (demoPos > 0 && demoPos < 23) {
    challenges.push({
      ladder_id: ladder.id, tenant_id: tenantId,
      challenger_user_id: ladderUsers[demoPos + 1].uid,
      challenged_user_id: demoId,
      challenger_position: demoPos + 2,
      challenged_position: demoPos + 1,
      status: "propuesto",
      proposed_at: new Date(Date.now() - 86400000).toISOString(),
      expires_at: new Date(Date.now() + 6 * 86400000).toISOString(),
    });
  }
  // Insertar desafíos. Si están en estado 'propuesto', el trigger
  // ensure_propuesto_has_schedule_proposal exige una propuesta de horarios:
  // creamos los challenges con status 'aceptado' inicialmente, luego insertamos
  // las propuestas para los originalmente 'propuesto' y revertimos el status.
  const desiredPropuesto = challenges.filter((c) => c.status === "propuesto").map((c, idx) => ({ idx, payload: c }));
  for (const c of challenges) if (c.status === "propuesto") c.status = "aceptado";
  const { data: insertedCh, error: chErr } = await admin.from("ladder_challenges").insert(challenges).select("id, challenger_user_id, challenged_user_id, status");
  if (chErr) console.error("ladder_challenges insert:", chErr.message);

  // Para cada uno que originalmente era 'propuesto', insertamos una propuesta de slots
  // y luego cambiamos el status de vuelta a 'propuesto' (el trigger es DEFERRABLE, valida al commit).
  if (insertedCh) {
    const propuestos = insertedCh.slice(0, desiredPropuesto.length);
    if (propuestos.length) {
      const { data: ct } = await admin.from("courts").select("id").eq("tenant_id", tenantId).limit(1).single();
      const courtId = ct?.id;
      const slotProps = propuestos.map((c) => ({
        challenge_id: c.id, tenant_id: tenantId,
        proposed_by: c.challenger_user_id,
        slot1_starts_at: new Date(Date.now() + 2 * 86400000).toISOString(),
        slot1_court_id: courtId,
        slot2_starts_at: new Date(Date.now() + 4 * 86400000).toISOString(),
        slot2_court_id: courtId,
        status: "pendiente",
      }));
      const { error: spErr } = await admin.from("ladder_challenge_schedule_proposals").insert(slotProps);
      if (spErr) console.error("schedule_proposals insert:", spErr.message);
      const ids = propuestos.map((c) => c.id);
      const { error: upErr } = await admin.from("ladder_challenges").update({ status: "propuesto" }).in("id", ids);
      if (upErr) console.error("ladder_challenges revert to propuesto:", upErr.message);
    }
  }
}

async function seedTournaments(tenantId: string, roster: SeedUser[], userIds: Map<string, string>, demoId: string, adminId: string) {
  const candidates = roster.filter((u) => u.role !== "club_admin" && u.email !== "demouser@aceplay.cl");
  const pickIds = (n: number, offset = 0) => candidates.slice(offset, offset + n).map((u) => userIds.get(u.email)!).filter(Boolean);

  // ---- TORNEO EN CURSO ----
  const ongoingStart = new Date(Date.now() - 5 * 86400000);
  const ongoingEnd = new Date(Date.now() + 9 * 86400000);
  const regOpen = new Date(Date.now() - 25 * 86400000);
  const regClose = new Date(Date.now() - 6 * 86400000);
  const { data: t1 } = await admin.from("tournaments").insert({
    tenant_id: tenantId, name: "Open Stade Français 2026", slug: "open-stade-2026",
    description: "Torneo abierto del club, modalidad eliminación directa.",
    entry_fee_clp: 15000,
    registration_opens_at: regOpen.toISOString(),
    registration_closes_at: regClose.toISOString(),
    starts_at: ongoingStart.toISOString(),
    ends_at: ongoingEnd.toISOString(),
    status: "en_curso",
    created_by: adminId,
  }).select("id").single();
  if (!t1) return;

  // Categoría Open Varones — demouser inscrito
  const { data: cat1 } = await admin.from("tournament_categories").insert({
    tournament_id: t1.id, tenant_id: tenantId,
    name: "Open Varones", category_label: "Open", gender: "varones",
    discipline: "tenis_singles", surface: "arcilla", max_participants: 8,
    status: "en_curso",
    bracket_generated_at: ongoingStart.toISOString(),
  }).select("id").single();

  if (cat1) {
    const players = [demoId, ...pickIds(7, 0)];
    const regs: any[] = [];
    for (let i = 0; i < 8; i++) {
      regs.push({
        tournament_id: t1.id, category_id: cat1.id, tenant_id: tenantId,
        player1_user_id: players[i], status: "confirmada", seed: i + 1,
        confirmed_at: regClose.toISOString(),
      });
    }
    const { data: insertedRegs } = await admin.from("tournament_registrations").insert(regs).select("id, player1_user_id");
    if (insertedRegs && insertedRegs.length === 8) {
      // R1: 4 partidos jugados; R2: 1 jugado, 1 programado; SF & F pendiente
      const matches: any[] = [];
      const r1Pairs = [[0, 7], [3, 4], [2, 5], [1, 6]];
      for (let i = 0; i < 4; i++) {
        const [a, b] = r1Pairs[i];
        const regA = insertedRegs[a].id, regB = insertedRegs[b].id;
        // demouser (index 0) gana su R1
        const winner = a === 0 ? regA : (Math.random() < 0.5 ? regA : regB);
        matches.push({
          tournament_id: t1.id, tenant_id: tenantId, category_id: cat1.id,
          round: 1, bracket_position: i + 1,
          registration_a_id: regA, registration_b_id: regB,
          winner_registration_id: winner,
          score: { sets: [[6, 3], [6, 4]] },
          status: "jugado",
          played_at: new Date(ongoingStart.getTime() + i * 3600000).toISOString(),
          acceptance_a: "accepted", acceptance_b: "accepted",
        });
      }
      // R2 sf1: ganador m1 vs ganador m2 — programado (incluye demouser)
      matches.push({
        tournament_id: t1.id, tenant_id: tenantId, category_id: cat1.id,
        round: 2, bracket_position: 1,
        registration_a_id: insertedRegs[0].id, registration_b_id: insertedRegs[3].id,
        status: "programado",
        scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(),
        acceptance_a: "accepted", acceptance_b: "accepted",
      });
      matches.push({
        tournament_id: t1.id, tenant_id: tenantId, category_id: cat1.id,
        round: 2, bracket_position: 2,
        registration_a_id: insertedRegs[2].id, registration_b_id: insertedRegs[1].id,
        status: "pendiente",
        acceptance_a: "pending", acceptance_b: "pending",
      });
      // Final pendiente
      matches.push({
        tournament_id: t1.id, tenant_id: tenantId, category_id: cat1.id,
        round: 3, bracket_position: 1, status: "pendiente",
        acceptance_a: "pending", acceptance_b: "pending",
      });
      const { error: mErr } = await admin.from("tournament_matches").insert(matches);
      if (mErr) console.error("tournament_matches insert:", mErr.message);
    }
  }

  // Categoría Open Damas
  const { data: cat2 } = await admin.from("tournament_categories").insert({
    tournament_id: t1.id, tenant_id: tenantId,
    name: "Open Damas", category_label: "Open", gender: "damas",
    discipline: "tenis_singles", surface: "arcilla", max_participants: 8,
    status: "en_curso",
  }).select("id").single();
  if (cat2) {
    // Excluir mujeres ya inscritas en varones (la unique constraint es por tournament+player1)
    const { data: existingRegs } = await admin.from("tournament_registrations").select("player1_user_id").eq("tournament_id", t1.id);
    const taken = new Set((existingRegs ?? []).map((r: any) => r.player1_user_id));
    const fems = roster
      .filter((u) => u.gender === "F" && u.role === "member")
      .map((u) => ({ u, uid: userIds.get(u.email)! }))
      .filter(({ uid }) => uid && !taken.has(uid))
      .slice(0, 6);
    const regs = fems.map(({ uid }, i) => ({
      tournament_id: t1.id, category_id: cat2.id, tenant_id: tenantId,
      player1_user_id: uid,
      status: "confirmada", seed: i + 1, confirmed_at: regClose.toISOString(),
    }));
    if (regs.length) {
      const { error: r2Err } = await admin.from("tournament_registrations").insert(regs);
      if (r2Err) console.error("tournament_registrations damas insert:", r2Err.message);
    }
  }

  // ---- TORNEO FINALIZADO ----
  const pastStart = new Date(Date.now() - 60 * 86400000);
  const pastEnd = new Date(Date.now() - 45 * 86400000);
  await admin.from("tournaments").insert({
    tenant_id: tenantId, name: "Copa Primavera 2025", slug: "copa-primavera-2025",
    description: "Torneo cerrado de primavera, finalizado.",
    entry_fee_clp: 10000,
    registration_opens_at: new Date(pastStart.getTime() - 14 * 86400000).toISOString(),
    registration_closes_at: new Date(pastStart.getTime() - 1 * 86400000).toISOString(),
    starts_at: pastStart.toISOString(), ends_at: pastEnd.toISOString(),
    status: "finalizado", created_by: adminId,
  });
}

async function seedCoaches(tenantId: string, userIds: Map<string, string>, roster: SeedUser[], courtIds: string[]) {
  const coaches = roster.filter((u) => u.role === "coach");
  const coachIds: string[] = [];
  for (const c of coaches) {
    const uid = userIds.get(c.email)!;
    const { data } = await admin.from("coach_profiles").insert({
      tenant_id: tenantId, user_id: uid,
      bio_pro: `Profesor ${c.first} ${c.last}, especialista en preparación física y técnica.`,
      years_coaching: 5 + Math.floor(Math.random() * 15),
      specialties: ["técnica", "preparación física"],
      languages: ["Español", "Francés"],
      hourly_rate_member_clp: 28000,
      hourly_rate_external_clp: 38000,
      hourly_rate_shared_clp: 35000,
      is_active: true,
      is_head_coach: c.email === "coach1@aceplay.cl",
    }).select("id").single();
    if (data) coachIds.push(data.id);
  }

  // Disponibilidad básica L–V 16-20h
  const avail: any[] = [];
  for (const cid of coachIds) {
    for (let day = 1; day <= 5; day++) {
      avail.push({ coach_id: cid, tenant_id: tenantId, weekday: day, starts_at: "16:00", ends_at: "20:00", is_recurring: true, is_active: true });
    }
  }
  if (avail.length) await admin.from("coach_availability").insert(avail);

  // 6 bloques de clase
  const blocks: any[] = [];
  for (let i = 0; i < 6; i++) {
    blocks.push({
      tenant_id: tenantId,
      court_id: courtIds[i % courtIds.length],
      coach_id: coachIds[i % coachIds.length],
      weekday: (i % 5) + 1,
      starts_at: `${17 + (i % 2)}:00`,
      ends_at: `${18 + (i % 2)}:00`,
      is_active: true,
      allow_external: true,
    });
  }
  await admin.from("coach_class_blocks").insert(blocks);
}

async function seedSocialFeatures(tenantId: string, userIds: Map<string, string>, demoId: string, roster: SeedUser[]) {
  const allIds = Array.from(userIds.values()).filter((id) => id !== demoId);

  // 5 match_open_posts
  const posts: any[] = [];
  for (let i = 0; i < 5; i++) {
    const uid = allIds[i % allIds.length];
    const day = new Date(); day.setDate(day.getDate() + 1 + i);
    posts.push({
      tenant_id: tenantId, user_id: uid, format: "best_of_3",
      available_slots: [
        { date: day.toISOString().slice(0, 10), start: "18:00", end: "20:00" },
        { date: day.toISOString().slice(0, 10), start: "20:00", end: "22:00" },
      ],
      note: "Busco partido competitivo, nivel NTRP 3.0–4.0.",
      status: "open",
      expires_at: new Date(Date.now() + 4 * 86400000).toISOString(),
    });
  }
  await admin.from("match_open_posts").insert(posts);

  // 1 invitación pendiente PARA demouser
  const inviter = allIds[0];
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 2);
  await admin.from("match_invitations").insert({
    tenant_id: tenantId,
    inviter_user_id: inviter, invitee_user_id: demoId,
    proposed_slots: [
      { date: tomorrow.toISOString().slice(0, 10), start: "18:00", end: "20:00" },
      { date: tomorrow.toISOString().slice(0, 10), start: "20:00", end: "22:00" },
    ],
    message: "Te propongo un partido el jueves. ¿Te acomoda?",
    status: "pending",
    expires_at: new Date(Date.now() + 3 * 86400000).toISOString(),
  });

  // Anuncios del club
  await admin.from("club_announcements").insert([
    {
      tenant_id: tenantId, title: "Inscripciones abiertas — Open Stade Français 2026",
      body: "Las inscripciones para el torneo Open están abiertas. Cupos limitados.",
      priority: "highlight", is_published: true,
    },
    {
      tenant_id: tenantId, title: "Mantención cancha 3",
      body: "La cancha 3 estará en mantención el próximo lunes de 8:00 a 12:00.",
      priority: "info", is_published: true,
      ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    },
  ]);

  // MOTW (semana actual)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  await admin.from("match_of_the_week").insert({
    tenant_id: tenantId, week_start: weekStart.toISOString().slice(0, 10),
    kind: "ladder", source_table: "ladder_challenges", source_id: crypto.randomUUID(),
    player_a_id: allIds[0], player_b_id: allIds[1], winner_id: allIds[0],
    level_a: 4.0, level_b: 3.8, level_diff: 0.2,
    score: { sets: [[6, 4], [4, 6], [7, 5]] },
    played_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    highlight_label: "Partido cerrado de pirámide",
  });

  await admin.from("suggested_matchup_of_the_week").insert({
    tenant_id: tenantId, week_start: weekStart.toISOString().slice(0, 10),
    player_a_id: demoId, player_b_id: allIds[2],
    level_a: 3.5, level_b: 3.6, level_diff: 0.1,
    score: 0.92,
    reason: "Niveles muy parejos y ambos disponibles esta semana",
  });
}

// ============================================================================
// SEED PÁDEL — Roster paralelo independiente del tenis
// ============================================================================

const PADEL_FIRST_M = ["Iván", "Álvaro", "Pablo", "Gonzalo", "Cristián", "Eduardo", "Manuel", "Javier", "Patricio", "Esteban", "Mauricio", "Rafael"];
const PADEL_FIRST_F = ["Daniela", "Paula", "Andrea", "Bárbara", "Macarena", "Pilar", "Karen", "Romina"];
const PADEL_LAST = ["Padilla", "Riveros", "Mella", "Sanhueza", "Ovalle", "Bravo", "Carrasco", "Hidalgo", "Núñez", "Pino", "Cáceres", "Rojas"];

function buildPadelRoster(): SeedUser[] {
  const roster: SeedUser[] = [
    { email: "padel-demo@aceplay.cl",   password: "PadelDemo2024",   first: "Pedro",  last: "Padel",  gender: "M", ntrp: 3.5, duesStatus: "al_dia", role: "member" },
    { email: "padel-hector@aceplay.cl", password: "PadelAdmin2024",  first: "Héctor", last: "Padel",  gender: "M", ntrp: 4.0, duesStatus: "al_dia", role: "club_admin" },
    { email: "padel-coach1@aceplay.cl", password: "PadelCoach2024",  first: "Andrés", last: "Pádelo", gender: "M", ntrp: 5.0, duesStatus: "al_dia", role: "coach" },
  ];
  for (let i = 0; i < 20; i++) {
    const isF = i % 4 === 0;
    const first = isF
      ? PADEL_FIRST_F[i % PADEL_FIRST_F.length]
      : PADEL_FIRST_M[i % PADEL_FIRST_M.length];
    const last = PADEL_LAST[i % PADEL_LAST.length];
    const ntrp = 2.5 + Math.round((i * 0.17) % 2.5 * 10) / 10;
    const dues = i % 9 === 0 ? "moroso" : i % 6 === 0 ? "pendiente" : "al_dia";
    roster.push({
      email: `padel-socio${(i + 1).toString().padStart(2, "0")}@aceplay.cl`,
      password: "PadelSocio2024",
      first, last, gender: isF ? "F" : "M",
      ntrp, duesStatus: dues as any, role: "member",
    });
  }
  return roster;
}

async function wipePadelRoster(tenantId: string) {
  const roster = buildPadelRoster();
  const emails = new Set(roster.map((u) => u.email.toLowerCase()));

  // 1) Recolectar uids vía RPC server-side (auth.users no es accesible vía PostgREST)
  const { data: lookup, error: lookupErr } = await admin.rpc("_e2e_lookup_users_by_email", {
    emails: roster.map((u) => u.email),
  });
  if (lookupErr) console.error("wipePadel lookup:", lookupErr.message);
  const uids: string[] = ((lookup ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
  console.log(`wipePadel: ${uids.length} auth users a borrar`);


  // 2) Limpiar filas dependientes por uid
  if (uids.length) {
    await admin.from("ladder_positions").delete().eq("tenant_id", tenantId).in("user_id", uids);
    await admin.from("ladder_challenges").delete().eq("tenant_id", tenantId).in("challenger_user_id", uids);
    await admin.from("player_ratings").delete().eq("tenant_id", tenantId).in("user_id", uids);
    await admin.from("tournament_registrations").delete().eq("tenant_id", tenantId).in("player1_user_id", uids);
    await admin.from("match_invitations").delete().eq("tenant_id", tenantId).in("inviter_user_id", uids);
    await admin.from("match_open_posts").delete().eq("tenant_id", tenantId).in("user_id", uids);
    await admin.from("user_roles").delete().eq("tenant_id", tenantId).in("user_id", uids);
    await admin.from("profiles").delete().eq("tenant_id", tenantId).in("user_id", uids);
  }

  // 3) Limpiar recursos pádel del tenant (ladders, torneos, canchas) y datos
  //    de pádel residuales de demouser/Héctor que SI deben re-sembrarse.
  const { data: crossUsers } = await admin.rpc("_e2e_lookup_users_by_email", {
    emails: ["demouser@aceplay.cl", "hectors42@gmail.com"],
  });
  const crossUids: string[] = ((crossUsers ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
  if (crossUids.length) {
    await admin.from("player_ratings").delete()
      .eq("tenant_id", tenantId).eq("sport", "padel").in("user_id", crossUids);
    await admin.from("match_open_posts").delete()
      .eq("tenant_id", tenantId).eq("sport", "padel").in("user_id", crossUids);
    // las invitaciones de pádel donde participan son borradas vía wipeTenant en scope=all;
    // en scope=padel sólo limpiamos las creadas por el roster pádel (ya hecho arriba).
  }

  await admin.from("ladders").delete().eq("tenant_id", tenantId).eq("discipline", "padel_dobles");
  const { data: padelTournaments } = await admin
    .from("tournaments").select("id").eq("tenant_id", tenantId).like("slug", "padel-%");
  for (const t of padelTournaments ?? []) {
    await admin.from("tournaments").delete().eq("id", t.id);
  }
  await admin.from("courts").delete().eq("tenant_id", tenantId).eq("sport", "padel");

  // 4) Borrar usuarios auth
  for (const uid of uids) {
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) console.error("deleteUser failed:", uid, error.message);
  }
}


async function seedPadel(tenantId: string) {
  const roster = buildPadelRoster();
  console.log(`seed-padel: creating ${roster.length} users`);
  const userIds = await createUsers(tenantId, roster);

  const now = new Date().toISOString();
  const profileRows: any[] = [];
  const roleRows: any[] = [];
  for (const u of roster) {
    const uid = userIds.get(u.email);
    if (!uid) continue;
    profileRows.push({
      user_id: uid, tenant_id: tenantId, email: u.email,
      first_name: u.first, last_name: u.last,
      ntrp_level: u.ntrp, dues_status: u.duesStatus,
      preferred_sport: "padel",
      padel_position: u.gender === "F" ? "reves" : "drive",
      padel_dominant_side: "drive",
      phone: "+56 9 " + Math.floor(10000000 + Math.random() * 89999999),
      accepted_terms_at: now, accepted_privacy_at: now,
      member_since: `20${(20 + Math.floor(Math.random() * 6))}-03-01`,
      theme: "etat-francais", theme_mode: "light",
    });
    roleRows.push({ user_id: uid, tenant_id: tenantId, role: u.role === "coach" ? "member" : u.role });
    if (u.role === "coach") roleRows.push({ user_id: uid, tenant_id: tenantId, role: "coach" });
  }
  const { error: pErr } = await admin
    .from("profiles")
    .upsert(profileRows, { onConflict: "user_id,tenant_id" });
  if (pErr) console.error("seed-padel profiles:", pErr.message);
  // Forzar preferred_sport='padel' (handle_new_user puede haber creado el profile con default 'tenis')
  const padelUids = Array.from(userIds.values());
  await admin
    .from("profiles")
    .update({ preferred_sport: "padel" })
    .eq("tenant_id", tenantId)
    .in("user_id", padelUids);
  const { error: rErr } = await admin
    .from("user_roles")
    .upsert(roleRows, { onConflict: "user_id,tenant_id,role" });
  if (rErr) console.error("seed-padel user_roles:", rErr.message);



  const courtRows = Array.from({ length: 4 }, (_, i) => ({
    tenant_id: tenantId,
    name: `Pádel ${i + 1}`,
    surface: "dura",
    sort_order: 10 + i,
    is_indoor: true,
    sport: "padel",
  }));
  const padelCourtIds: string[] = [];
  for (const c of courtRows) {
    const { data, error } = await admin.from("courts").insert(c as any).select("id").single();
    if (error) console.error("seed-padel court:", error.message);
    else if (data) padelCourtIds.push(data.id);
  }

  const ratingRows = roster.map((u) => {
    const uid = userIds.get(u.email);
    if (!uid) return null;
    return {
      tenant_id: tenantId, user_id: uid, sport: "padel",
      level: u.ntrp, initial_level: u.ntrp,
      reliability: 55 + Math.floor(Math.random() * 35),
      matches_played: 3 + Math.floor(Math.random() * 20),
      competitive_matches: 1 + Math.floor(Math.random() * 10),
      last_match_at: new Date(Date.now() - Math.random() * 45 * 86400000).toISOString(),
      onboarding_completed_at: now,
    };
  }).filter(Boolean);
  await admin.from("player_ratings").insert(ratingRows as any);

  // ---- Cross-sport: insertar rating de pádel para demouser y Héctor Smith ----
  const { data: crossLookup } = await admin.rpc("_e2e_lookup_users_by_email", {
    emails: ["demouser@aceplay.cl", "hectors42@gmail.com"],
  });
  const crossMap = new Map<string, string>();
  for (const row of (crossLookup ?? []) as Array<{ user_id: string; email: string }>) {
    crossMap.set(row.email.toLowerCase(), row.user_id);
  }
  const demoTenisId = crossMap.get("demouser@aceplay.cl") ?? null;
  const hectorTenisId = crossMap.get("hectors42@gmail.com") ?? null;

  const crossRatingRows: any[] = [];
  if (demoTenisId) {
    crossRatingRows.push({
      tenant_id: tenantId, user_id: demoTenisId, sport: "padel",
      level: 3.2, initial_level: 3.0, reliability: 72,
      matches_played: 14, competitive_matches: 6,
      last_match_at: new Date(Date.now() - 4 * 86400000).toISOString(),
      onboarding_completed_at: now,
    });
  }
  if (hectorTenisId) {
    crossRatingRows.push({
      tenant_id: tenantId, user_id: hectorTenisId, sport: "padel",
      level: 4.1, initial_level: 3.8, reliability: 85,
      matches_played: 22, competitive_matches: 11,
      last_match_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      onboarding_completed_at: now,
    });
  }
  if (crossRatingRows.length) {
    const { error: crErr } = await admin.from("player_ratings").insert(crossRatingRows);
    if (crErr) console.error("seed-padel cross ratings:", crErr.message);
  }

  const padelDemoId = userIds.get("padel-demo@aceplay.cl")!;
  const padelHectorId = userIds.get("padel-hector@aceplay.cl")!;
  const { data: ladder } = await admin.from("ladders").insert({
    tenant_id: tenantId,
    name: "La Staderilla Pádel Verano 2026",
    description: "Pirámide oficial de pádel dobles del club, temporada Verano 2026",
    discipline: "padel_dobles",
    gender: "mixto",
    surface: "dura",
    is_active: true,
    season_starts_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    season_ends_at: new Date(Date.now() + 65 * 86400000).toISOString(),
  }).select("id").single();

  if (ladder) {
    const others = roster
      .filter((u) => u.role === "member" && u.email !== "padel-demo@aceplay.cl")
      .map((u) => ({ uid: userIds.get(u.email)!, ntrp: u.ntrp }))
      .filter((x) => x.uid)
      .sort((a, b) => b.ntrp - a.ntrp);
    const hectorIdx = others.findIndex((x) => x.uid === padelHectorId);
    if (hectorIdx >= 0) others.splice(hectorIdx, 1);
    const ladderUsers: string[] = [];
    if (others[0]) ladderUsers.push(others[0].uid);     // #1
    ladderUsers.push(padelHectorId);                     // #2
    if (hectorTenisId) ladderUsers.push(hectorTenisId); // #3 Héctor Smith
    if (others[1]) ladderUsers.push(others[1].uid);     // #4
    ladderUsers.push(padelDemoId);                       // #5
    for (let i = 2; ladderUsers.length < 20 && i < others.length; i++) {
      ladderUsers.push(others[i].uid);
    }
    // Insertar demouser cerca de la mitad (pos #9)
    if (demoTenisId && !ladderUsers.includes(demoTenisId)) {
      const insertAt = Math.min(8, ladderUsers.length);
      ladderUsers.splice(insertAt, 0, demoTenisId);
    }
    const positions = ladderUsers.map((uid, idx) => ({
      ladder_id: ladder.id, tenant_id: tenantId, user_id: uid,
      position: idx + 1, status: "activo",
      wins: Math.floor(Math.random() * 5),
      losses: Math.floor(Math.random() * 3),
      last_played_at: new Date(Date.now() - Math.random() * 15 * 86400000).toISOString(),
      joined_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    }));
    await admin.from("ladder_positions").insert(positions);

    const challenges: any[] = [];
    for (let i = 0; i < 8; i++) {
      const cIdx = 4 + (i % 10);
      const dIdx = cIdx - 1 - (i % 2);
      if (dIdx < 0 || cIdx >= ladderUsers.length) continue;
      const challenger = ladderUsers[cIdx];
      const challenged = ladderUsers[dIdx];
      const cPartner = ladderUsers[(cIdx + 5) % ladderUsers.length];
      const dPartner = ladderUsers[(dIdx + 7) % ladderUsers.length];
      if (!challenger || !challenged || cPartner === challenger || dPartner === challenged) continue;
      if (cPartner === challenged || dPartner === challenger) continue;
      const winner = i % 3 === 0 ? challenger : challenged;
      const loser = winner === challenger ? challenged : challenger;
      const playedAt = new Date(Date.now() - (8 - i) * 3 * 86400000).toISOString();
      challenges.push({
        ladder_id: ladder.id, tenant_id: tenantId,
        challenger_user_id: challenger, challenged_user_id: challenged,
        challenger_partner_user_id: cPartner, challenged_partner_user_id: dPartner,
        challenger_position: cIdx + 1, challenged_position: dIdx + 1,
        status: "jugado",
        winner_user_id: winner, loser_user_id: loser,
        score: { sets: [[6, 4], [6, 3]] },
        proposed_at: playedAt, played_at: playedAt, result_confirmed_at: playedAt,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
    }
    if (challenges.length) {
      const { error: cErr } = await admin.from("ladder_challenges").insert(challenges);
      if (cErr) console.error("seed-padel challenges:", cErr.message);
    }
  }

  const allPadelIds = Array.from(userIds.values()).filter((id) => id !== padelDemoId);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 2);
  const day = tomorrow.toISOString().slice(0, 10);
  await admin.from("match_open_posts").insert({
    tenant_id: tenantId, user_id: padelDemoId,
    sport: "padel", match_type: "doubles", mode: "open_slots",
    slots_total: 4, format: "best_of_3", gender_filter: "any",
    available_slots: [{ date: day, start: "18:00", end: "20:00" }],
    note: "Dobles pádel competitivo, nivel 3.0–4.0. ¡Únete!",
    status: "open",
    expires_at: new Date(Date.now() + 4 * 86400000).toISOString(),
  });
  const partnerId = allPadelIds[0];
  await admin.from("match_open_posts").insert({
    tenant_id: tenantId, user_id: padelHectorId,
    sport: "padel", match_type: "doubles", mode: "pair_vs_pair",
    slots_total: 4, format: "best_of_3", gender_filter: "any",
    partner_user_id: partnerId,
    available_slots: [{ date: day, start: "20:00", end: "22:00" }],
    note: "Buscamos pareja para 2v2 pádel viernes en la noche.",
    status: "open",
    expires_at: new Date(Date.now() + 4 * 86400000).toISOString(),
  });

  const inviter = allPadelIds[1];
  const invs: any[] = [];
  for (let i = 0; i < 3; i++) {
    const invitee = allPadelIds[2 + i];
    if (!invitee || invitee === inviter) continue;
    invs.push({
      tenant_id: tenantId,
      inviter_user_id: inviter, invitee_user_id: invitee,
      proposed_slots: [{ date: day, start: "18:00", end: "20:00" }],
      message: "¿Jugamos pádel esta semana?", status: "pending",
      expires_at: new Date(Date.now() + 3 * 86400000).toISOString(),
    });
  }
  if (invs.length) await admin.from("match_invitations").insert(invs);

  // ---- Cross-sport open posts & invitations: demouser y Héctor en pádel ----
  const crossPadelPosts: any[] = [];
  if (demoTenisId) {
    crossPadelPosts.push({
      tenant_id: tenantId, user_id: demoTenisId,
      sport: "padel", match_type: "doubles", mode: "open_slots",
      slots_total: 4, format: "best_of_3", gender_filter: "any",
      available_slots: [{ date: day, start: "19:00", end: "21:00" }],
      note: "Busco 3 para dobles de pádel nivel 3.0-3.5.",
      status: "open",
      expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    });
  }
  if (hectorTenisId && demoTenisId) {
    crossPadelPosts.push({
      tenant_id: tenantId, user_id: hectorTenisId,
      sport: "padel", match_type: "doubles", mode: "pair_vs_pair",
      slots_total: 4, format: "best_of_3", gender_filter: "any",
      partner_user_id: demoTenisId,
      available_slots: [{ date: day, start: "20:00", end: "22:00" }],
      note: "Dupla con Pierre buscando rivales 2v2 en pádel.",
      status: "open",
      expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    });
  }
  if (crossPadelPosts.length) {
    const { error: cpErr } = await admin.from("match_open_posts").insert(crossPadelPosts);
    if (cpErr) console.error("seed-padel cross posts:", cpErr.message);
  }

  // 1 invitación pendiente PARA demouser desde un socio de pádel
  if (demoTenisId && allPadelIds[3]) {
    const { error: ciErr } = await admin.from("match_invitations").insert({
      tenant_id: tenantId,
      inviter_user_id: allPadelIds[3],
      invitee_user_id: demoTenisId,
      proposed_slots: [{ date: day, start: "18:00", end: "20:00" }],
      message: "Pierre, ¿armamos un dobles de pádel esta semana?",
      status: "pending",
      expires_at: new Date(Date.now() + 3 * 86400000).toISOString(),
    });
    if (ciErr) console.error("seed-padel cross invitation:", ciErr.message);
  }

  const tStart = new Date(Date.now() - 3 * 86400000);
  const tEnd = new Date(Date.now() + 11 * 86400000);
  const { data: padelTournament } = await admin.from("tournaments").insert({
    tenant_id: tenantId, name: "Open Pádel Stade 2026", slug: "padel-open-2026",
    description: "Torneo abierto de pádel dobles, eliminación directa.",
    entry_fee_clp: 20000,
    registration_opens_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    registration_closes_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    starts_at: tStart.toISOString(), ends_at: tEnd.toISOString(),
    status: "en_curso",
    created_by: padelHectorId,
  }).select("id").single();

  if (padelTournament) {
    const { data: cat } = await admin.from("tournament_categories").insert({
      tournament_id: padelTournament.id, tenant_id: tenantId,
      name: "Open Mixto Pádel", category_label: "Open", gender: "mixto",
      discipline: "padel_dobles", surface: "dura", max_participants: 8,
      status: "en_curso",
      bracket_generated_at: tStart.toISOString(),
    }).select("id").single();

    if (cat) {
      const players = [padelDemoId, ...allPadelIds.slice(0, 15)];
      const pairs: any[] = [];
      for (let i = 0; i < 8; i++) {
        const p1 = players[i * 2];
        const p2 = players[i * 2 + 1];
        if (!p1 || !p2 || p1 === p2) continue;
        pairs.push({
          tournament_id: padelTournament.id, category_id: cat.id, tenant_id: tenantId,
          player1_user_id: p1, player2_user_id: p2,
          status: "confirmada", seed: i + 1,
          confirmed_at: new Date(Date.now() - 4 * 86400000).toISOString(),
        });
      }
      const { data: insertedRegs, error: regErr } = await admin
        .from("tournament_registrations").insert(pairs).select("id");
      if (regErr) console.error("seed-padel regs:", regErr.message);

      if (insertedRegs && insertedRegs.length === 8) {
        const matches: any[] = [];
        const r1Pairs = [[0, 7], [3, 4], [2, 5], [1, 6]];
        for (let i = 0; i < 4; i++) {
          const [a, b] = r1Pairs[i];
          const regA = insertedRegs[a].id, regB = insertedRegs[b].id;
          if (i < 2) {
            const winner = i === 0 ? regA : (Math.random() < 0.5 ? regA : regB);
            matches.push({
              tournament_id: padelTournament.id, tenant_id: tenantId, category_id: cat.id,
              round: 1, bracket_position: i + 1,
              registration_a_id: regA, registration_b_id: regB,
              winner_registration_id: winner,
              score: { sets: [[6, 4], [7, 5]] }, status: "jugado",
              played_at: new Date(tStart.getTime() + i * 7200000).toISOString(),
              acceptance_a: "accepted", acceptance_b: "accepted",
            });
          } else {
            matches.push({
              tournament_id: padelTournament.id, tenant_id: tenantId, category_id: cat.id,
              round: 1, bracket_position: i + 1,
              registration_a_id: regA, registration_b_id: regB,
              status: "programado",
              scheduled_at: new Date(Date.now() + (i - 1) * 86400000).toISOString(),
              acceptance_a: "accepted", acceptance_b: "accepted",
            });
          }
        }
        matches.push({ tournament_id: padelTournament.id, tenant_id: tenantId, category_id: cat.id,
          round: 2, bracket_position: 1, status: "pendiente", acceptance_a: "pending", acceptance_b: "pending" });
        matches.push({ tournament_id: padelTournament.id, tenant_id: tenantId, category_id: cat.id,
          round: 2, bracket_position: 2, status: "pendiente", acceptance_a: "pending", acceptance_b: "pending" });
        matches.push({ tournament_id: padelTournament.id, tenant_id: tenantId, category_id: cat.id,
          round: 3, bracket_position: 1, status: "pendiente", acceptance_a: "pending", acceptance_b: "pending" });
        const { error: mErr } = await admin.from("tournament_matches").insert(matches);
        if (mErr) console.error("seed-padel matches:", mErr.message);
      }
    }
  }

  return {
    users: userIds.size,
    courts: padelCourtIds.length,
    demoId: padelDemoId,
    hectorId: padelHectorId,
    ladderId: ladder?.id,
    tournamentId: padelTournament?.id,
  };
}

// ============================================================================
// HTTP entry point
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // --- Environment guard: NEVER seed/destroy data in production. ---
  // APP_ENV is expected to be one of: 'development' | 'staging' | 'production'.
  // If unset OR set to 'production', this function aborts before touching data,
  // so even a leaked SEED_KEY cannot wipe live tenants.
  const appEnv = (Deno.env.get("APP_ENV") || "production").toLowerCase();
  if (appEnv !== "development" && appEnv !== "staging") {
    return new Response(
      JSON.stringify({
        error: "Production guard: seed-stade-demo is disabled outside dev/staging",
        app_env: appEnv,
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const seedKey = Deno.env.get("SEED_KEY");
  const provided = req.headers.get("x-seed-key");
  if (!seedKey || provided !== seedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let scope: "all" | "tenis" | "padel" = "all";
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.scope === "tenis" || body?.scope === "padel") scope = body.scope;
      } catch { /* sin body */ }
    }
    console.log(`seed-stade-demo: starting (scope=${scope})`);

    let tenantId: string;
    let tenisStats: any = null;
    if (scope === "all" || scope === "tenis") {
      await wipeTenant();
      tenantId = await createTenant();
      const roster = buildRoster();
      const userIds = await createUsers(tenantId, roster);
      await configureProfilesAndRoles(tenantId, roster, userIds);
      await seedClubConfig(tenantId);
      const courtIds = await seedCourts(tenantId);
      await seedRatings(tenantId, roster, userIds);
      const demoId = userIds.get("demouser@aceplay.cl")!;
      const adminId = userIds.get("admin@aceplay.cl")!;
      await seedBookings(tenantId, courtIds, userIds, demoId);
      await seedLadder(tenantId, roster, userIds, demoId);
      await seedTournaments(tenantId, roster, userIds, demoId, adminId);
      await seedCoaches(tenantId, userIds, roster, courtIds);
      await seedSocialFeatures(tenantId, userIds, demoId, roster);
      tenisStats = { users: userIds.size, courts: courtIds.length };
    } else {
      const { data: t } = await admin.from("tenants").select("id").eq("slug", TENANT_SLUG).maybeSingle();
      if (!t) throw new Error("scope=padel requiere tenant Stade Français existente. Corre antes scope=all o scope=tenis.");
      tenantId = t.id;
    }

    let padelStats: any = null;
    if (scope === "all" || scope === "padel") {
      await wipePadelRoster(tenantId);
      padelStats = await seedPadel(tenantId);
    }

    console.log("seed-stade-demo: done");
    return new Response(JSON.stringify({
      ok: true, scope, tenantId, tenis: tenisStats, padel: padelStats,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("seed-stade-demo error:", e?.message, e?.stack);
    return new Response(JSON.stringify({ ok: false, error: e?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
