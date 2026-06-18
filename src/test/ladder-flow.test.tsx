import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateIcsContent } from "@/lib/ics";

/**
 * E2E del flujo de Pirámide entre los usuarios estándar de prueba:
 *   - demouser@aceplay.cl  (#11 en "Pirámide Verano 2026")
 *   - hectors42@gmail.com  (Héctor Smith, #6)
 *
 * El test simula el flujo completo contra mocks de los RPC de Supabase.
 * Verifica:
 *   1. Demo crea desafío válido (jump=5).
 *   2. Héctor acepta.
 *   3. Héctor propone 3 horarios.
 *   4. Demo confirma slot 2 → se crea booking.
 *   5. Se genera .ics correcto.
 *   6. Demo carga resultado (gana Héctor 6-3 6-2).
 *   7. Héctor confirma → estadísticas actualizadas.
 */

const DEMO_ID = "demo-uuid-0000-0000-0000-000000000011";
const HECTOR_ID = "hect-uuid-0000-0000-0000-000000000006";
const TENANT_ID = "tenant-stade-francais";
const LADDER_ID = "ladder-piramide-verano-2026";
const COURT_ID = "court-1";

interface DbState {
  challenges: Array<Record<string, unknown>>;
  proposals: Array<Record<string, unknown>>;
  bookings: Array<Record<string, unknown>>;
  positions: Array<Record<string, unknown>>;
}

const createDb = (): DbState => ({
  challenges: [],
  proposals: [],
  bookings: [],
  positions: [
    { user_id: DEMO_ID, position: 11, wins: 0, losses: 0, ladder_id: LADDER_ID },
    { user_id: HECTOR_ID, position: 6, wins: 0, losses: 0, ladder_id: LADDER_ID },
  ],
});

const rpcMock = (db: DbState) =>
  vi.fn(async (name: string, params: Record<string, unknown>) => {
    switch (name) {
      case "create_ladder_challenge": {
        // Validar jump <= 5 (regla nueva del ladder)
        const challengerPos = 11;
        const challengedPos = 6;
        const jump = challengerPos - challengedPos;
        if (jump > 5) {
          return { data: null, error: { message: `Máximo 5 puestos de salto` } };
        }
        const id = `chal-${db.challenges.length + 1}`;
        db.challenges.push({
          id,
          ladder_id: LADDER_ID,
          tenant_id: TENANT_ID,
          challenger_user_id: DEMO_ID,
          challenged_user_id: HECTOR_ID,
          challenger_position: challengerPos,
          challenged_position: challengedPos,
          status: "propuesto",
          expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        });
        return { data: id, error: null };
      }
      case "respond_ladder_challenge": {
        const c = db.challenges.find((x) => x.id === params._challenge_id);
        if (!c) return { data: null, error: { message: "no encontrado" } };
        c.status = params._accept ? "aceptado" : "rechazado";
        return { data: true, error: null };
      }
      case "propose_ladder_challenge_slots": {
        const slots = params._slots as Array<{ court_id: string; starts_at: string }>;
        if (slots.length < 1 || slots.length > 3) {
          return { data: null, error: { message: "1 a 3 horarios" } };
        }
        const id = `prop-${db.proposals.length + 1}`;
        db.proposals.push({
          id,
          challenge_id: params._challenge_id,
          proposed_by: HECTOR_ID,
          slot1_court_id: slots[0].court_id,
          slot1_starts_at: slots[0].starts_at,
          slot2_court_id: slots[1]?.court_id ?? null,
          slot2_starts_at: slots[1]?.starts_at ?? null,
          slot3_court_id: slots[2]?.court_id ?? null,
          slot3_starts_at: slots[2]?.starts_at ?? null,
          status: "pendiente",
        });
        return { data: id, error: null };
      }
      case "confirm_ladder_challenge_slot": {
        const p = db.proposals.find((x) => x.id === params._proposal_id);
        if (!p) return { data: null, error: { message: "propuesta no encontrada" } };
        const slotIndex = params._slot_index as number;
        const startsAt = p[`slot${slotIndex}_starts_at`] as string;
        const courtId = p[`slot${slotIndex}_court_id`] as string;
        if (!startsAt) return { data: null, error: { message: "slot inválido" } };
        p.selected_slot = slotIndex;
        p.selected_at = new Date().toISOString();
        p.status = "confirmada";
        const bookingId = `book-${db.bookings.length + 1}`;
        db.bookings.push({
          id: bookingId,
          tenant_id: TENANT_ID,
          court_id: courtId,
          user_id: DEMO_ID,
          partner_user_id: HECTOR_ID,
          starts_at: startsAt,
          ends_at: new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString(),
          kind: "socio",
          status: "confirmada",
        });
        const c = db.challenges.find((x) => x.id === p.challenge_id);
        if (c) {
          c.status = "programado";
          c.scheduled_at = startsAt;
          c.court_id = courtId;
          c.booking_id = bookingId;
        }
        return { data: bookingId, error: null };
      }
      case "submit_ladder_result": {
        const c = db.challenges.find((x) => x.id === params._challenge_id);
        if (!c) return { data: null, error: { message: "no encontrado" } };
        c.result_proposed_by = DEMO_ID;
        c.result_proposed_at = new Date().toISOString();
        c.winner_user_id = params._winner_user_id;
        c.score = params._score;
        c.played_at = new Date().toISOString();
        return { data: true, error: null };
      }
      case "confirm_ladder_result": {
        const c = db.challenges.find((x) => x.id === params._challenge_id);
        if (!c) return { data: null, error: { message: "no encontrado" } };
        c.status = "jugado";
        c.result_confirmed_at = new Date().toISOString();
        const winnerId = c.winner_user_id;
        const loserId = winnerId === DEMO_ID ? HECTOR_ID : DEMO_ID;
        const winner = db.positions.find((p) => p.user_id === winnerId);
        const loser = db.positions.find((p) => p.user_id === loserId);
        if (winner) winner.wins = (winner.wins as number) + 1;
        if (loser) loser.losses = (loser.losses as number) + 1;
        // loser_drops_position=false en esta Pirámide → solo swap si retador (Demo) gana
        if (winnerId === DEMO_ID) {
          const demo = db.positions.find((p) => p.user_id === DEMO_ID)!;
          const hector = db.positions.find((p) => p.user_id === HECTOR_ID)!;
          [demo.position, hector.position] = [hector.position, demo.position];
        }
        return { data: true, error: null };
      }
      default:
        return { data: null, error: { message: `RPC ${name} no mockeado` } };
    }
  });

describe("Ladder E2E: Demo (#11) vs Héctor (#6)", () => {
  let db: DbState;
  let rpc: ReturnType<typeof rpcMock>;

  beforeEach(() => {
    db = createDb();
    rpc = rpcMock(db);
  });

  it("1) Demo crea desafío con jump=5 (válido tras migración)", async () => {
    const { data, error } = await rpc("create_ladder_challenge", {
      _ladder_id: LADDER_ID,
      _challenged_user_id: HECTOR_ID,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(db.challenges).toHaveLength(1);
    expect(db.challenges[0].status).toBe("propuesto");
  });

  it("2) Héctor acepta el desafío", async () => {
    await rpc("create_ladder_challenge", { _ladder_id: LADDER_ID, _challenged_user_id: HECTOR_ID });
    const id = db.challenges[0].id as string;
    const { error } = await rpc("respond_ladder_challenge", { _challenge_id: id, _accept: true });
    expect(error).toBeNull();
    expect(db.challenges[0].status).toBe("aceptado");
  });

  it("3) Héctor propone 3 horarios", async () => {
    await rpc("create_ladder_challenge", { _ladder_id: LADDER_ID, _challenged_user_id: HECTOR_ID });
    const id = db.challenges[0].id as string;
    await rpc("respond_ladder_challenge", { _challenge_id: id, _accept: true });
    const tomorrow = new Date(Date.now() + 86400000);
    const slots = [0, 1, 2].map((i) => ({
      court_id: COURT_ID,
      starts_at: new Date(tomorrow.getTime() + i * 86400000).toISOString(),
    }));
    const { error, data } = await rpc("propose_ladder_challenge_slots", {
      _challenge_id: id,
      _slots: slots,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(db.proposals).toHaveLength(1);
    expect(db.proposals[0].slot2_starts_at).toBeTruthy();
  });

  it("4) Demo confirma slot 2 → se crea booking con partner=Héctor", async () => {
    await rpc("create_ladder_challenge", { _ladder_id: LADDER_ID, _challenged_user_id: HECTOR_ID });
    const id = db.challenges[0].id as string;
    await rpc("respond_ladder_challenge", { _challenge_id: id, _accept: true });
    const tomorrow = new Date(Date.now() + 86400000);
    const slots = [0, 1, 2].map((i) => ({
      court_id: COURT_ID,
      starts_at: new Date(tomorrow.getTime() + i * 86400000).toISOString(),
    }));
    await rpc("propose_ladder_challenge_slots", { _challenge_id: id, _slots: slots });
    const propId = db.proposals[0].id as string;
    const { error } = await rpc("confirm_ladder_challenge_slot", {
      _proposal_id: propId,
      _slot_index: 2,
    });
    expect(error).toBeNull();
    expect(db.bookings).toHaveLength(1);
    expect(db.bookings[0].kind).toBe("socio");
    expect(db.bookings[0].partner_user_id).toBe(HECTOR_ID);
    expect(db.bookings[0].user_id).toBe(DEMO_ID);
    expect(db.challenges[0].status).toBe("programado");
  });

  it("5) Genera .ics con datos correctos del partido", () => {
    const startsAt = new Date("2026-05-01T18:00:00Z");
    const endsAt = new Date("2026-05-01T19:00:00Z");
    const ics = generateIcsContent({
      title: "Pirámide vs Héctor Smith",
      description: "Desafío Pirámide Verano 2026 · #11 vs #6",
      location: "Cancha 1 · Stade Français",
      startsAt,
      endsAt,
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("SUMMARY:Pirámide vs Héctor Smith");
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("TZID:America/Santiago");
    expect(ics).toContain("DTSTART;TZID=America/Santiago:20260501T140000");
    expect(ics).toContain("DTEND;TZID=America/Santiago:20260501T150000");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT60M");
    expect(ics).toContain("LOCATION:Cancha 1 · Stade Français");
  });

  it("6 + 7) Demo carga resultado, Héctor confirma → estadísticas actualizadas (sin swap)", async () => {
    // Setup: desafío programado
    await rpc("create_ladder_challenge", { _ladder_id: LADDER_ID, _challenged_user_id: HECTOR_ID });
    const id = db.challenges[0].id as string;
    await rpc("respond_ladder_challenge", { _challenge_id: id, _accept: true });
    const slots = [{ court_id: COURT_ID, starts_at: new Date(Date.now() + 86400000).toISOString() }];
    await rpc("propose_ladder_challenge_slots", { _challenge_id: id, _slots: slots });
    await rpc("confirm_ladder_challenge_slot", {
      _proposal_id: db.proposals[0].id,
      _slot_index: 1,
    });

    // Demo carga: gana Héctor 6-3 6-2
    const score = [
      { a: 3, b: 6 },
      { a: 2, b: 6 },
    ];
    await rpc("submit_ladder_result", {
      _challenge_id: id,
      _winner_user_id: HECTOR_ID,
      _score: score,
    });
    expect(db.challenges[0].winner_user_id).toBe(HECTOR_ID);

    // Héctor confirma
    await rpc("confirm_ladder_result", { _challenge_id: id });
    expect(db.challenges[0].status).toBe("jugado");

    // Verificar estadísticas
    const hector = db.positions.find((p) => p.user_id === HECTOR_ID)!;
    const demo = db.positions.find((p) => p.user_id === DEMO_ID)!;
    expect(hector.wins).toBe(1);
    expect(demo.losses).toBe(1);
    // loser_drops_position=false → no hay swap cuando gana el defensor
    expect(hector.position).toBe(6);
    expect(demo.position).toBe(11);
  });

  it("Caso inverso: si Demo (retador) ganara, ocurre swap de posiciones", async () => {
    await rpc("create_ladder_challenge", { _ladder_id: LADDER_ID, _challenged_user_id: HECTOR_ID });
    const id = db.challenges[0].id as string;
    await rpc("respond_ladder_challenge", { _challenge_id: id, _accept: true });
    const slots = [{ court_id: COURT_ID, starts_at: new Date(Date.now() + 86400000).toISOString() }];
    await rpc("propose_ladder_challenge_slots", { _challenge_id: id, _slots: slots });
    await rpc("confirm_ladder_challenge_slot", {
      _proposal_id: db.proposals[0].id,
      _slot_index: 1,
    });
    await rpc("submit_ladder_result", {
      _challenge_id: id,
      _winner_user_id: DEMO_ID,
      _score: [{ a: 6, b: 4 }, { a: 6, b: 3 }],
    });
    await rpc("confirm_ladder_result", { _challenge_id: id });

    const hector = db.positions.find((p) => p.user_id === HECTOR_ID)!;
    const demo = db.positions.find((p) => p.user_id === DEMO_ID)!;
    expect(demo.position).toBe(6);
    expect(hector.position).toBe(11);
    expect(demo.wins).toBe(1);
    expect(hector.losses).toBe(1);
  });
});
