export type Role =
  | "admin"
  | "org"
  | "org2"
  | "playerA"
  | "playerB";

const ENV_MAP: Record<Role, { email: string; password: string }> = {
  admin: { email: "QA_ADMIN_EMAIL", password: "QA_ADMIN_PASSWORD" },
  org: { email: "QA_ORG_EMAIL", password: "QA_ORG_PASSWORD" },
  org2: { email: "QA_ORG2_EMAIL", password: "QA_ORG2_PASSWORD" },
  playerA: { email: "QA_PLAYER_A_EMAIL", password: "QA_PLAYER_A_PASSWORD" },
  playerB: { email: "QA_PLAYER_B_EMAIL", password: "QA_PLAYER_B_PASSWORD" },
};

export function getCredentials(role: Role): { email: string; password: string } {
  const ref = ENV_MAP[role];
  const email = process.env[ref.email];
  const password = process.env[ref.password];
  if (!email || !password) {
    throw new Error(
      `[e2e] credenciales faltantes para rol '${role}' (${ref.email}/${ref.password})`,
    );
  }
  return { email, password };
}