// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  tournament_id: string;
  format: "pdf" | "xlsx" | "csv";
  mode?: "full" | "rules" | "report";
}

function setsLabel(score: any): string {
  if (!Array.isArray(score)) return "";
  return score
    .map((s: any) => {
      const tb =
        s.tb_a != null && s.tb_b != null ? `(${Math.min(s.tb_a, s.tb_b)})` : "";
      return `${s.a}-${s.b}${tb}`;
    })
    .join(" ");
}

function playerLabel(reg: any, profilesById: Map<string, any>): string {
  if (!reg) return "BYE";
  const p1 = profilesById.get(reg.player1_user_id);
  const p1Name = p1 ? `${p1.first_name} ${p1.last_name}` : "—";
  if (!reg.player2_user_id) return p1Name;
  const p2 = profilesById.get(reg.player2_user_id);
  const p2Name = p2 ? `${p2.first_name} ${p2.last_name}` : "—";
  return `${p1Name} / ${p2Name}`;
}

function roundLabel(round: number, totalRounds: number): string {
  if (round === 1) return "Final";
  if (round === 2) return "Semifinal";
  if (round === 3) return "Cuartos de final";
  if (round === 4) return "Octavos de final";
  if (round === 5) return "16avos";
  if (round === 6) return "32avos";
  return `Ronda ${totalRounds - round + 1}`;
}

function hexToRgb(hex: string | null | undefined): { r: number; g: number; b: number } {
  if (!hex) return { r: 0.71, g: 0.31, b: 0.17 }; // clay
  const h = hex.replace("#", "");
  if (h.length !== 6) return { r: 0.71, g: 0.31, b: 0.17 };
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function stripMd(md: string | null | undefined): string {
  if (!md) return "";
  return md
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, (m) => m.trim() + " ")
    .replace(/`([^`]+)`/g, "$1");
}

async function buildRulesPdf(args: {
  tournamentName: string;
  clubName: string;
  cobrand: any | null;
  rules: any | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const A4 = { w: 595.28, h: 841.89 };
  const margin = 56; // ~20mm
  const primary = hexToRgb(args.cobrand?.primary_hex);
  const accent = hexToRgb(args.cobrand?.accent_hex);

  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h;

  // Cover gradient band
  page.drawRectangle({
    x: 0,
    y: A4.h - 200,
    width: A4.w,
    height: 200,
    color: rgb(primary.r, primary.g, primary.b),
  });
  page.drawRectangle({
    x: 0,
    y: A4.h - 200,
    width: A4.w,
    height: 6,
    color: rgb(accent.r, accent.g, accent.b),
  });

  page.drawText("REGLAMENTO", {
    x: margin,
    y: A4.h - 80,
    size: 10,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  const title = args.tournamentName;
  page.drawText(title, {
    x: margin,
    y: A4.h - 130,
    size: 28,
    font: fontItalic,
    color: rgb(1, 1, 1),
    maxWidth: A4.w - margin * 2,
  });
  if (args.cobrand?.display_name || args.clubName) {
    page.drawText(args.cobrand?.display_name ?? args.clubName, {
      x: margin,
      y: A4.h - 160,
      size: 12,
      font,
      color: rgb(1, 1, 1),
      opacity: 0.9,
    });
  }

  y = A4.h - 240;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - margin;
    }
  };

  const wrapText = (text: string, size: number, f = font, maxW = A4.w - margin * 2): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxW) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const drawHeading = (label: string) => {
    ensureSpace(40);
    page.drawText(label.toUpperCase(), {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: rgb(primary.r, primary.g, primary.b),
    });
    y -= 8;
    page.drawLine({
      start: { x: margin, y },
      end: { x: A4.w - margin, y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 14;
  };

  const drawParagraph = (text: string, size = 10) => {
    if (!text) return;
    for (const rawLine of text.split("\n")) {
      if (!rawLine.trim()) {
        y -= 6;
        continue;
      }
      const lines = wrapText(rawLine.trim(), size);
      for (const line of lines) {
        ensureSpace(size + 4);
        page.drawText(line, { x: margin, y, size, font, color: rgb(0.17, 0.11, 0.07) });
        y -= size + 4;
      }
    }
    y -= 4;
  };

  const rules = args.rules;

  if (!rules) {
    drawParagraph("El organizador aún no publicó un reglamento.");
  } else {
    if (rules.descriptive_md) {
      drawHeading("Descripción");
      drawParagraph(stripMd(rules.descriptive_md));
    }

    if (Array.isArray(rules.format_table_json) && rules.format_table_json.length > 0) {
      drawHeading("Formato");
      for (const row of rules.format_table_json) {
        ensureSpace(16);
        page.drawText((row.key ?? "").toUpperCase(), {
          x: margin,
          y,
          size: 8,
          font: fontBold,
          color: rgb(0.45, 0.45, 0.45),
        });
        const valueLines = wrapText(String(row.value ?? ""), 10, font, A4.w - margin * 2 - 140);
        let vy = y;
        for (const vl of valueLines) {
          page.drawText(vl, { x: margin + 140, y: vy, size: 10, font, color: rgb(0.17, 0.11, 0.07) });
          vy -= 12;
        }
        y = Math.min(y - 12, vy);
      }
      y -= 4;
    }

    if (rules.key_rules_md) {
      drawHeading("Reglas clave");
      drawParagraph(stripMd(rules.key_rules_md));
    }
    if (rules.tiebreak_rules_md) {
      drawHeading("Desempate & premiación");
      drawParagraph(stripMd(rules.tiebreak_rules_md));
    }
    if (rules.player_guide_md) {
      drawHeading("Cómo competir — Guía del jugador");
      drawParagraph(stripMd(rules.player_guide_md));
    }
    if (rules.operator_guide_md) {
      drawHeading("Guía del operador");
      drawParagraph(stripMd(rules.operator_guide_md));
    }
    if (rules.image_rights_md) {
      drawHeading("Derechos de imagen");
      drawParagraph(stripMd(rules.image_rights_md));
    }
  }

  // Footer on every page
  const pages = pdf.getPages();
  const footerText = `AcePlay${args.cobrand?.display_name ? ` × ${args.cobrand.display_name}` : ""} · v${rules?.version ?? 1} · ${new Date().toLocaleDateString("es-CL")}`;
  for (const p of pages) {
    p.drawText(footerText, {
      x: margin,
      y: 24,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  return await pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleNames = (roles ?? []).map((r: { role: string }) => r.role);
    const isAdmin =
      roleNames.includes("super_admin") || roleNames.includes("club_admin");

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .maybeSingle();

    const body = (await req.json()) as Body;
    if (!body?.tournament_id || !["pdf", "xlsx", "csv"].includes(body.format)) {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── REPORT MODE (post-event informe — PDF or CSV de eventos) ────────
    if (body.mode === "report") {
      // Authorization: any tournament manager
      const { data: canManage } = await supabase.rpc("is_tournament_manager", {
        _tournament_id: body.tournament_id,
      });
      if (!canManage) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.format === "csv") {
        const { data: events } = await supabase
          .from("tournament_events")
          .select("kind, at, payload")
          .eq("tournament_id", body.tournament_id)
          .order("at", { ascending: true });
        const rows = events ?? [];
        const lines: string[] = ["kind,at,payload"];
        for (const r of rows) {
          const payload = JSON.stringify(r.payload ?? {}).replace(/"/g, '""');
          lines.push(`${r.kind},${r.at},"${payload}"`);
        }
        const csv = "\uFEFF" + lines.join("\n");
        return new Response(csv, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="eventos.csv"`,
          },
        });
      }

      // PDF informe
      const { data: metrics, error: mErr } = await supabase.rpc(
        "tournament_report_metrics",
        { _tournament_id: body.tournament_id },
      );
      if (mErr || !metrics) {
        return new Response(
          JSON.stringify({ error: mErr?.message ?? "No metrics" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const pdfBytes = await buildReportPdf(metrics as Record<string, unknown>);
      return new Response(pdfBytes, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="informe.pdf"`,
        },
      });
    }

    // ─── RULES MODE (public reglamento PDF) ──────────────────────────────
    if (body.mode === "rules" && body.format === "pdf") {
      const { data: t } = await supabase
        .from("tournaments")
        .select("id, name, tenants(name)")
        .eq("id", body.tournament_id)
        .maybeSingle();
      if (!t) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: rules } = await supabase
        .from("tournament_rules")
        .select("*")
        .eq("tournament_id", body.tournament_id)
        .eq("is_current", true)
        .maybeSingle();
      const { data: cobrand } = await supabase
        .from("tournament_cobrand")
        .select("display_name, primary_hex, accent_hex")
        .eq("tournament_id", body.tournament_id)
        .maybeSingle();

      const pdf = await buildRulesPdf({
        tournamentName: (t as any).name,
        clubName: (t as any).tenants?.name ?? "",
        cobrand,
        rules,
      });
      return new Response(pdf, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="reglamento.pdf"`,
        },
      });
    }

    // ─── FULL EXPORT (requires admin) ────────────────────────────────────
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tournament + tenant
    const { data: tournament, error: tErr } = await supabase
      .from("tournaments")
      .select("*, tenants(*)")
      .eq("id", body.tournament_id)
      .maybeSingle();
    if (tErr || !tournament) {
      return new Response(JSON.stringify({ error: "Tournament not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      !roleNames.includes("super_admin") &&
      callerProfile?.tenant_id !== tournament.tenant_id
    ) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: categories } = await supabase
      .from("tournament_categories")
      .select("*")
      .eq("tournament_id", body.tournament_id)
      .order("sort_order");

    const { data: registrations } = await supabase
      .from("tournament_registrations")
      .select("*")
      .eq("tournament_id", body.tournament_id);

    const { data: matches } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", body.tournament_id)
      .order("round", { ascending: false })
      .order("bracket_position");

    const { data: courts } = await supabase
      .from("courts")
      .select("id, name")
      .eq("tenant_id", tournament.tenant_id);

    const userIds = new Set<string>();
    (registrations ?? []).forEach((r: any) => {
      userIds.add(r.player1_user_id);
      if (r.player2_user_id) userIds.add(r.player2_user_id);
    });
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, ntrp_level, club_ranking")
      .in("user_id", userIds.size ? Array.from(userIds) : ["00000000-0000-0000-0000-000000000000"]);

    const profilesById = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    const regsById = new Map((registrations ?? []).map((r: any) => [r.id, r]));
    const courtsById = new Map((courts ?? []).map((c: any) => [c.id, c.name]));

    const tenant = (tournament as any).tenants;
    const clubName = tenant?.name ?? "Club";

    if (body.format === "xlsx") {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Resumen
      const summary = [
        ["Torneo", tournament.name],
        ["Club", clubName],
        ["Estado", tournament.status],
        ["Inicio", new Date(tournament.starts_at).toLocaleDateString("es-CL")],
        ["Fin", new Date(tournament.ends_at).toLocaleDateString("es-CL")],
        ["Categorías", (categories ?? []).length],
        ["Inscritos totales", (registrations ?? []).length],
        ["Partidos totales", (matches ?? []).length],
        [
          "Partidos jugados",
          (matches ?? []).filter((m: any) => m.status === "jugado" || m.status === "walkover").length,
        ],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summary);
      wsSummary["!cols"] = [{ wch: 22 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");

      // Sheet 2: Inscritos por categoría
      const regsRows: any[][] = [
        ["Categoría", "Jugador 1", "Jugador 2", "Estado", "Seed", "Inscrito el"],
      ];
      for (const cat of categories ?? []) {
        const catRegs = (registrations ?? []).filter((r: any) => r.category_id === cat.id);
        for (const r of catRegs) {
          const p1 = profilesById.get(r.player1_user_id);
          const p2 = r.player2_user_id ? profilesById.get(r.player2_user_id) : null;
          regsRows.push([
            cat.name,
            p1 ? `${p1.first_name} ${p1.last_name}` : "—",
            p2 ? `${p2.first_name} ${p2.last_name}` : "",
            r.status,
            r.seed ?? "",
            new Date(r.registered_at).toLocaleString("es-CL"),
          ]);
        }
      }
      const wsRegs = XLSX.utils.aoa_to_sheet(regsRows);
      wsRegs["!cols"] = [
        { wch: 22 },
        { wch: 28 },
        { wch: 28 },
        { wch: 16 },
        { wch: 6 },
        { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, wsRegs, "Inscritos");

      // Sheet 3: Partidos y resultados
      const matchRows: any[][] = [
        [
          "Categoría",
          "Ronda",
          "Posición",
          "Jugador A",
          "Jugador B",
          "Marcador",
          "Ganador",
          "Estado",
          "Cancha",
          "Programado",
          "Jugado",
        ],
      ];
      for (const cat of categories ?? []) {
        const catMatches = (matches ?? []).filter((m: any) => m.category_id === cat.id);
        const totalRounds = Math.max(...catMatches.map((m: any) => m.round), 1);
        for (const m of catMatches) {
          const ra = regsById.get(m.registration_a_id);
          const rb = regsById.get(m.registration_b_id);
          const winner = m.winner_registration_id ? regsById.get(m.winner_registration_id) : null;
          matchRows.push([
            cat.name,
            roundLabel(m.round, totalRounds),
            m.bracket_position,
            playerLabel(ra, profilesById),
            playerLabel(rb, profilesById),
            setsLabel(m.score),
            winner ? playerLabel(winner, profilesById) : "",
            m.status,
            m.court_id ? courtsById.get(m.court_id) ?? "" : "",
            m.scheduled_at ? new Date(m.scheduled_at).toLocaleString("es-CL") : "",
            m.played_at ? new Date(m.played_at).toLocaleString("es-CL") : "",
          ]);
        }
      }
      const wsMatches = XLSX.utils.aoa_to_sheet(matchRows);
      wsMatches["!cols"] = [
        { wch: 22 },
        { wch: 18 },
        { wch: 8 },
        { wch: 28 },
        { wch: 28 },
        { wch: 18 },
        { wch: 28 },
        { wch: 12 },
        { wch: 14 },
        { wch: 18 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsMatches, "Partidos");

      // Sheet 4: Ranking final por categoría
      const rankRows: any[][] = [["Categoría", "Posición", "Jugador(es)"]];
      for (const cat of categories ?? []) {
        const catMatches = (matches ?? []).filter((m: any) => m.category_id === cat.id);
        const finalMatch = catMatches.find((m: any) => m.round === 1);
        const semis = catMatches.filter((m: any) => m.round === 2);
        if (finalMatch?.winner_registration_id) {
          const champion = regsById.get(finalMatch.winner_registration_id);
          const runnerUpId =
            finalMatch.winner_registration_id === finalMatch.registration_a_id
              ? finalMatch.registration_b_id
              : finalMatch.registration_a_id;
          const runnerUp = runnerUpId ? regsById.get(runnerUpId) : null;
          rankRows.push([cat.name, "1°", playerLabel(champion, profilesById)]);
          if (runnerUp) rankRows.push([cat.name, "2°", playerLabel(runnerUp, profilesById)]);
          for (const sf of semis) {
            const loserId =
              sf.winner_registration_id === sf.registration_a_id
                ? sf.registration_b_id
                : sf.registration_a_id;
            const loser = loserId ? regsById.get(loserId) : null;
            if (loser) rankRows.push([cat.name, "3°-4°", playerLabel(loser, profilesById)]);
          }
        }
      }
      const wsRank = XLSX.utils.aoa_to_sheet(rankRows);
      wsRank["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 32 }];
      XLSX.utils.book_append_sheet(wb, wsRank, "Ranking Final");

      const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      const filename = `${tournament.slug || "torneo"}.xlsx`;
      return new Response(buffer, {
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Brand color (parse from tenant.brand_primary "16 78% 48%")
    const hslMatch = tenant?.brand_primary?.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
    const brand = hslMatch
      ? hslToRgb(Number(hslMatch[1]), Number(hslMatch[2]) / 100, Number(hslMatch[3]) / 100)
      : { r: 0.78, g: 0.32, b: 0.11 };

    let page = pdfDoc.addPage([595, 842]); // A4
    let y = 800;
    const margin = 50;
    const lineH = 14;

    const drawText = (text: string, opts: { size?: number; bold?: boolean; color?: any } = {}) => {
      const size = opts.size ?? 10;
      const f = opts.bold ? fontBold : font;
      const color = opts.color ?? rgb(0.1, 0.1, 0.1);
      page.drawText(text, { x: margin, y, size, font: f, color });
      y -= size + 4;
    };

    const ensureSpace = (needed: number) => {
      if (y - needed < 60) {
        page = pdfDoc.addPage([595, 842]);
        y = 800;
      }
    };

    // Header band
    page.drawRectangle({
      x: 0,
      y: 780,
      width: 595,
      height: 62,
      color: rgb(brand.r, brand.g, brand.b),
    });
    page.drawText(clubName.toUpperCase(), {
      x: margin,
      y: 815,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText(tournament.name, {
      x: margin,
      y: 795,
      size: 16,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    y = 760;

    drawText(
      `${new Date(tournament.starts_at).toLocaleDateString("es-CL")} — ${new Date(
        tournament.ends_at,
      ).toLocaleDateString("es-CL")}`,
      { size: 10, color: rgb(0.4, 0.4, 0.4) },
    );
    y -= 8;

    for (const cat of categories ?? []) {
      ensureSpace(120);
      // Category title
      page.drawRectangle({
        x: margin - 4,
        y: y - 4,
        width: 495,
        height: 22,
        color: rgb(0.96, 0.94, 0.91),
      });
      page.drawText(cat.name, {
        x: margin,
        y: y + 4,
        size: 13,
        font: fontBold,
        color: rgb(brand.r * 0.6, brand.g * 0.6, brand.b * 0.6),
      });
      y -= 28;

      const catMatches = (matches ?? []).filter((m: any) => m.category_id === cat.id);
      const totalRounds = catMatches.length ? Math.max(...catMatches.map((m: any) => m.round)) : 1;

      // Ranking
      const finalMatch = catMatches.find((m: any) => m.round === 1);
      if (finalMatch?.winner_registration_id) {
        const champion = regsById.get(finalMatch.winner_registration_id);
        const runnerUpId =
          finalMatch.winner_registration_id === finalMatch.registration_a_id
            ? finalMatch.registration_b_id
            : finalMatch.registration_a_id;
        const runnerUp = runnerUpId ? regsById.get(runnerUpId) : null;

        drawText("Ranking final", { size: 10, bold: true });
        drawText(`  1° ${playerLabel(champion, profilesById)}`, { size: 10 });
        if (runnerUp) drawText(`  2° ${playerLabel(runnerUp, profilesById)}`, { size: 10 });
        const semis = catMatches.filter((m: any) => m.round === 2);
        for (const sf of semis) {
          const loserId =
            sf.winner_registration_id === sf.registration_a_id
              ? sf.registration_b_id
              : sf.registration_a_id;
          const loser = loserId ? regsById.get(loserId) : null;
          if (loser) drawText(`  3°-4° ${playerLabel(loser, profilesById)}`, { size: 10 });
        }
        y -= 6;
      }

      // Matches list grouped by round
      const rounds = Array.from(new Set(catMatches.map((m: any) => m.round))).sort(
        (a: any, b: any) => b - a,
      );
      for (const r of rounds) {
        ensureSpace(40);
        drawText(roundLabel(r, totalRounds), { size: 11, bold: true, color: rgb(0.2, 0.2, 0.2) });
        const roundMatches = catMatches.filter((m: any) => m.round === r);
        for (const m of roundMatches) {
          ensureSpace(lineH * 2);
          const ra = regsById.get(m.registration_a_id);
          const rb = regsById.get(m.registration_b_id);
          const score = setsLabel(m.score);
          const winnerIsA = m.winner_registration_id === m.registration_a_id;
          const winnerIsB = m.winner_registration_id === m.registration_b_id;
          const aLabel = playerLabel(ra, profilesById);
          const bLabel = playerLabel(rb, profilesById);
          page.drawText(winnerIsA ? ">" : " ", {
            x: margin,
            y,
            size: 9,
            font: fontBold,
            color: rgb(brand.r, brand.g, brand.b),
          });
          page.drawText(aLabel, {
            x: margin + 12,
            y,
            size: 9,
            font: winnerIsA ? fontBold : font,
            color: rgb(0.1, 0.1, 0.1),
          });
          if (score)
            page.drawText(score, { x: margin + 380, y, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
          y -= lineH;
          page.drawText(winnerIsB ? ">" : " ", {
            x: margin,
            y,
            size: 9,
            font: fontBold,
            color: rgb(brand.r, brand.g, brand.b),
          });
          page.drawText(bLabel, {
            x: margin + 12,
            y,
            size: 9,
            font: winnerIsB ? fontBold : font,
            color: rgb(0.1, 0.1, 0.1),
          });
          y -= lineH + 4;
        }
        y -= 6;
      }
      y -= 10;
    }

    // Footer on last page
    page.drawText(`Generado ${new Date().toLocaleString("es-CL")}`, {
      x: margin,
      y: 30,
      size: 8,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });

    const pdfBytes = await pdfDoc.save();
    const filename = `${tournament.slug || "torneo"}.pdf`;
    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("export-tournament error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: r + m, g: g + m, b: b + m };
}

// ─── REPORT PDF ────────────────────────────────────────────────────────
async function buildReportPdf(metrics: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const A4 = { w: 595, h: 842 };
  const margin = 48;
  const brand = hexToRgb(metrics?.tournament?.cobrand?.primary_hex ?? null);
  const cobrandName = metrics?.tournament?.cobrand?.display_name ?? null;
  const ink = rgb(0.17, 0.11, 0.07);
  const muted = rgb(0.45, 0.45, 0.45);

  function drawFooter(page: any) {
    const footer = `aceplay${cobrandName ? ` × ${cobrandName}` : ""} · juega.aceplay.app`;
    page.drawText(footer, { x: margin, y: 24, size: 8, font, color: muted });
    page.drawText(
      `Generado ${new Date().toLocaleString("es-CL")}`,
      { x: A4.w - margin - 140, y: 24, size: 8, font, color: muted },
    );
  }

  function newPage() {
    const p = pdf.addPage([A4.w, A4.h]);
    return p;
  }

  // ── Page 1 · Cover ─────────────────────────────────────────────────
  {
    const page = newPage();
    // Top color band
    page.drawRectangle({ x: 0, y: A4.h - 120, width: A4.w, height: 120, color: rgb(brand.r, brand.g, brand.b) });
    page.drawText("INFORME OFICIAL · v1", {
      x: margin, y: A4.h - 60, size: 9, font: fontBold, color: rgb(1, 1, 1),
    });
    const name = String(metrics?.tournament?.name ?? "Torneo");
    page.drawText(name, { x: margin, y: A4.h - 95, size: 22, font: fontBold, color: rgb(1, 1, 1) });

    const starts = metrics?.tournament?.starts_at ? new Date(metrics.tournament.starts_at).toLocaleDateString("es-CL") : "—";
    const ends = metrics?.tournament?.ends_at ? new Date(metrics.tournament.ends_at).toLocaleDateString("es-CL") : "—";
    page.drawText(`Fechas: ${starts} → ${ends}`, { x: margin, y: A4.h - 160, size: 11, font, color: ink });
    if (cobrandName) {
      page.drawText(`Co-marca: ${cobrandName}`, { x: margin, y: A4.h - 180, size: 11, font: fontItalic, color: ink });
    }
    page.drawText(`Snapshot: ${new Date(metrics?.snapshot_at ?? Date.now()).toLocaleString("es-CL")}`, {
      x: margin, y: A4.h - 200, size: 10, font, color: muted,
    });
    drawFooter(page);
  }

  // ── Page 2 · Participation & play ─────────────────────────────────
  {
    const page = newPage();
    let y = A4.h - margin;
    page.drawText("PARTICIPACIÓN", { x: margin, y, size: 10, font: fontBold, color: rgb(brand.r, brand.g, brand.b) });
    y -= 24;
    const p = metrics?.participation ?? {};
    const play = metrics?.play ?? {};
    const lines: Array<[string, string]> = [
      ["Confirmados", `${p.confirmed_players ?? 0}${p.total_slots ? ` / ${p.total_slots}` : ""} (${p.fill_rate ?? 0}%)`],
      ["Categorías", String(p.category_count ?? 0)],
      ["Sesiones", String(p.session_count ?? 0)],
      ["Canchas", String(p.court_count ?? 0)],
      ["Operadores", String(metrics?.operators?.count ?? 0)],
      ["Partidos jugados", `${play.matches_played ?? 0} / ${play.matches_total ?? 0} (${play.completion_rate ?? 0}%)`],
      ["Rondas", String(play.rounds_total ?? 0)],
    ];
    for (const [k, v] of lines) {
      page.drawText(k.toUpperCase(), { x: margin, y, size: 8, font: fontBold, color: muted });
      page.drawText(v, { x: margin + 180, y, size: 11, font, color: ink });
      y -= 18;
    }
    drawFooter(page);
  }

  // ── Page 3 · Share ────────────────────────────────────────────────
  {
    const page = newPage();
    let y = A4.h - margin;
    page.drawText("COMPARTIDO", { x: margin, y, size: 10, font: fontBold, color: rgb(brand.r, brand.g, brand.b) });
    y -= 24;
    const s = metrics?.share ?? {};
    const lines: Array<[string, string]> = [
      ["Opens", String(s.opens ?? 0)],
      ["Descargas", String(s.downloads ?? 0)],
      ["Compartidos", String(s.shares ?? 0)],
      ["Usuarios únicos", String(s.unique_users ?? 0)],
    ];
    for (const [k, v] of lines) {
      page.drawText(k.toUpperCase(), { x: margin, y, size: 8, font: fontBold, color: muted });
      page.drawText(v, { x: margin + 180, y, size: 11, font, color: ink });
      y -= 18;
    }
    y -= 12;
    page.drawText("TOP KINDS", { x: margin, y, size: 8, font: fontBold, color: muted });
    y -= 16;
    const topKinds: Array<{ kind: string; count: number }> = Array.isArray(s.top_kinds) ? s.top_kinds : [];
    if (topKinds.length === 0) {
      page.drawText("Sin datos", { x: margin, y, size: 10, font: fontItalic, color: muted });
      y -= 16;
    } else {
      for (const t of topKinds) {
        page.drawText(`• ${t.kind}`, { x: margin, y, size: 10, font, color: ink });
        page.drawText(String(t.count), { x: margin + 180, y, size: 10, font: fontBold, color: ink });
        y -= 14;
      }
    }
    drawFooter(page);
  }

  // ── Page 4 · Captación + AVE ──────────────────────────────────────
  {
    const page = newPage();
    let y = A4.h - margin;
    page.drawText("CAPTACIÓN", { x: margin, y, size: 10, font: fontBold, color: rgb(brand.r, brand.g, brand.b) });
    y -= 24;
    const c = metrics?.captacion ?? {};
    const lines: Array<[string, string]> = [
      ["Clicks «Activar mi nivel»", String(c.activate_clicks ?? 0)],
      ["Conversiones", String(c.conversions ?? 0)],
      ["Tasa de conversión", `${c.conversion_rate ?? 0}%`],
    ];
    for (const [k, v] of lines) {
      page.drawText(k.toUpperCase(), { x: margin, y, size: 8, font: fontBold, color: muted });
      page.drawText(v, { x: margin + 220, y, size: 11, font, color: ink });
      y -= 18;
    }

    y -= 30;
    page.drawText("VALOR PUBLICITARIO ESTIMADO", { x: margin, y, size: 10, font: fontBold, color: rgb(brand.r, brand.g, brand.b) });
    y -= 30;
    const ave = Number(metrics?.ave_clp ?? 0);
    const aveStr = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(ave);
    page.drawText(aveStr, { x: margin, y, size: 28, font: fontBold, color: ink });
    y -= 22;
    const disclaimer = "* Estimación in-app basada en CPM industria. El alcance real RRSS lo entrega producción del cliente.";
    const words = disclaimer.split(" ");
    let line = "";
    const maxW = A4.w - margin * 2;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (fontItalic.widthOfTextAtSize(test, 9) > maxW) {
        page.drawText(line, { x: margin, y, size: 9, font: fontItalic, color: muted });
        y -= 12;
        line = w;
      } else {
        line = test;
      }
    }
    if (line) page.drawText(line, { x: margin, y, size: 9, font: fontItalic, color: muted });
    drawFooter(page);
  }

  return await pdf.save();
}
