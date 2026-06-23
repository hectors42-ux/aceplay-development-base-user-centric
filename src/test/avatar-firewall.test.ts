import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Firewall del avatar: cambiar el avatar SOLO toca `profiles` (+ storage). Nunca
 * el motor de Rating, XP ni Fichas. Auditamos:
 *   - el trigger DB que protege a menores (_enforce_avatar_privacy) y
 *   - el código de front que persiste el avatar (AvatarPicker / useAvatar),
 * verificando que no referencien símbolos de esas capas.
 */

const ROOT = process.cwd();
const FORBIDDEN = [
  "player_ratings", "rating_history", "points_ledger", "apply_match_to_ratings",
  "xp_ledger", "award_xp", "league_members", "close_league_week", "fichas",
];

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
}

describe("Firewall: cambiar avatar solo toca profiles (ni rating, ni XP, ni fichas)", () => {
  it("el trigger _enforce_avatar_privacy solo toca columnas de profiles", () => {
    const sql = stripSqlComments(
      readFileSync(join(ROOT, "supabase", "migrations", "20260622120000_avatar_identity.sql"), "utf8"),
    );
    const m = sql.match(/function\s+public\._enforce_avatar_privacy\(\)[\s\S]*?\$\$;/);
    expect(m).toBeTruthy();
    const body = m![0];
    for (const token of FORBIDDEN) expect(body).not.toContain(token);
    // Sólo manipula campos de avatar del propio row.
    expect(body).toMatch(/new\.avatar_kind/);
  });

  it("el path de front (AvatarPicker + useAvatar) solo escribe profiles/storage", () => {
    const picker = readFileSync(join(ROOT, "src", "pages", "AvatarPicker.tsx"), "utf8");
    const hook = readFileSync(join(ROOT, "src", "hooks", "useAvatar.ts"), "utf8");
    for (const token of FORBIDDEN) {
      expect(picker).not.toContain(token);
      expect(hook).not.toContain(token);
    }
    // Persistencia: profiles (+ storage para la foto). Nada de RPCs de rating/economía.
    expect(picker).toMatch(/\.from\("profiles"\)/);
    expect(picker).toMatch(/storage\.from\("avatars"\)/);
    expect(picker).not.toMatch(/\.rpc\(/);
  });
});
