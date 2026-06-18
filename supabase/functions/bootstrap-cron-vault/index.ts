// One-shot bootstrap: stores CRON_SECRET (and anon key) into Supabase Vault
// so pg_cron jobs can read them from vault.decrypted_secrets without keeping
// the plaintext in cron.job.command.
//
// Self-locking: once cron_secret exists in the vault, the endpoint refuses
// further calls. Returns 403 after the first successful bootstrap.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-seed-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!cronSecret || !anonKey) {
      return new Response(
        JSON.stringify({ error: "Missing CRON_SECRET or SUPABASE_ANON_KEY env" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Self-lock: refuse if already bootstrapped
    const { data: existing, error: chkErr } = await supabase.rpc(
      "_bootstrap_vault_has_cron_secret",
    );
    if (chkErr) throw chkErr;
    if (existing === true) {
      return new Response(
        JSON.stringify({ ok: false, error: "Already bootstrapped (locked)" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error } = await supabase.rpc("_bootstrap_vault_secret_upsert", {
      _name: "cron_secret",
      _secret: cronSecret,
    });
    if (error) throw error;

    const { error: e2 } = await supabase.rpc("_bootstrap_vault_secret_upsert", {
      _name: "cron_anon_key",
      _secret: anonKey,
    });
    if (e2) throw e2;

    return new Response(
      JSON.stringify({ ok: true, stored: ["cron_secret", "cron_anon_key"] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
