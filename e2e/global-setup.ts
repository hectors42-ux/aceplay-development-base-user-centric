import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.e2e" });

const REQUIRED = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "QA_TENANT_SLUG",
  "QA_ADMIN_EMAIL",
  "QA_ADMIN_PASSWORD",
  "QA_ORG_EMAIL",
  "QA_ORG_PASSWORD",
  "QA_ORG2_EMAIL",
  "QA_ORG2_PASSWORD",
  "QA_PLAYER_A_EMAIL",
  "QA_PLAYER_A_PASSWORD",
  "QA_PLAYER_B_EMAIL",
  "QA_PLAYER_B_PASSWORD",
] as const;

export default async function globalSetup() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `[e2e] Faltan variables en .env.e2e: ${missing.join(", ")}`,
    );
  }
  if (process.env.QA_TENANT_SLUG !== "qa-sandbox") {
    throw new Error(
      `[e2e] QA_TENANT_SLUG debe ser 'qa-sandbox', recibido '${process.env.QA_TENANT_SLUG}'. Abortando.`,
    );
  }

  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // eslint-disable-next-line no-console
  console.log("[e2e] qa_reset('qa-sandbox') …");
  const resetRes = await admin.rpc("qa_reset", { p_slug: "qa-sandbox" });
  if (resetRes.error) {
    throw new Error(`[e2e] qa_reset falló: ${resetRes.error.message}`);
  }

  // eslint-disable-next-line no-console
  console.log("[e2e] qa_seed_all() …");
  const seedRes = await admin.rpc("qa_seed_all");
  if (seedRes.error) {
    throw new Error(`[e2e] qa_seed_all falló: ${seedRes.error.message}`);
  }

  const { count, error: countErr } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq(
      "tenant_id",
      (
        await admin
          .from("tenants")
          .select("id")
          .eq("slug", "qa-sandbox")
          .single()
      ).data?.id,
    );
  if (countErr) {
    throw new Error(`[e2e] sanity profiles falló: ${countErr.message}`);
  }
  if ((count ?? 0) < 200) {
    throw new Error(
      `[e2e] sanity check: esperaba ≥200 profiles en qa-sandbox, hay ${count}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(`[e2e] mundo QA listo (${count} profiles).`);
}