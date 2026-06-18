import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Cliente service_role para LEER datos del seed (no mutar). */
export function adminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("[e2e] SUPABASE_URL/SERVICE_ROLE_KEY no definidos");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export async function getQaTenantId(): Promise<string> {
  const { data, error } = await adminClient()
    .from("tenants")
    .select("id")
    .eq("slug", "qa-sandbox")
    .single();
  if (error || !data) {
    throw new Error(`[e2e] no se encontró tenant qa-sandbox: ${error?.message}`);
  }
  return data.id;
}

export async function findTournamentByFormat(
  format: string,
): Promise<{ id: string; name: string } | null> {
  const tenantId = await getQaTenantId();
  const { data, error } = await adminClient()
    .from("tournaments")
    .select("id, name, format")
    .eq("tenant_id", tenantId)
    .eq("format", format)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`[e2e] findTournamentByFormat(${format}): ${error.message}`);
  }
  return data ?? null;
}