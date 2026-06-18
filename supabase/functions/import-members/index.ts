import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MemberRow {
  email: string;
  first_name: string;
  last_name: string;
  rut?: string | null;
  phone?: string | null;
  role?: "member" | "staff" | "club_admin";
}

interface RequestBody {
  members: MemberRow[];
  send_email?: boolean;
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente con JWT del usuario para verificar identidad y roles
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Obtener tenant del admin y verificar que sea club_admin
    const { data: profile } = await userClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Perfil no encontrado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roleNames = (roles ?? []).map((r: { role: string }) => r.role);
    const canAdmin =
      roleNames.includes("super_admin") || roleNames.includes("club_admin");
    if (!canAdmin) {
      return new Response(JSON.stringify({ error: "Permisos insuficientes" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile.tenant_id;

    const body: RequestBody = await req.json();
    if (!body?.members || !Array.isArray(body.members) || body.members.length === 0) {
      return new Response(JSON.stringify({ error: "Lista de socios vacía" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.members.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Máximo 1000 socios por importación" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cliente service_role para crear invitaciones bypass RLS
    const adminClient = createClient(supabaseUrl, serviceKey);

    type Result = {
      email: string;
      status: "invited" | "skipped" | "error";
      reason?: string;
      invitation_url?: string;
    };
    const results: Result[] = [];
    const origin = req.headers.get("origin") ?? "";

    for (const raw of body.members) {
      const email = (raw.email || "").trim().toLowerCase();
      const firstName = (raw.first_name || "").trim();
      const lastName = (raw.last_name || "").trim();

      if (!email || !isEmail(email)) {
        results.push({ email: raw.email || "(vacío)", status: "error", reason: "Email inválido" });
        continue;
      }
      if (!firstName || !lastName) {
        results.push({ email, status: "error", reason: "Falta nombre o apellido" });
        continue;
      }

      // ¿Ya hay perfil con este email en el tenant?
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", email)
        .maybeSingle();
      if (existingProfile) {
        results.push({ email, status: "skipped", reason: "Ya es socio" });
        continue;
      }

      // ¿Ya hay invitación pendiente?
      const { data: existingInvite } = await adminClient
        .from("member_invitations")
        .select("id, token, accepted_at")
        .eq("tenant_id", tenantId)
        .eq("email", email)
        .maybeSingle();

      if (existingInvite && !existingInvite.accepted_at) {
        const url = `${origin}/accept-invitation?token=${existingInvite.token}`;
        results.push({ email, status: "skipped", reason: "Invitación ya enviada", invitation_url: url });
        continue;
      }

      const { data: invite, error: inviteErr } = await adminClient
        .from("member_invitations")
        .insert({
          tenant_id: tenantId,
          email,
          first_name: firstName,
          last_name: lastName,
          rut: raw.rut?.trim() || null,
          phone: raw.phone?.trim() || null,
          role: raw.role ?? "member",
          invited_by: user.id,
        })
        .select("token")
        .single();

      if (inviteErr || !invite) {
        results.push({ email, status: "error", reason: inviteErr?.message ?? "Error al crear invitación" });
        continue;
      }

      const url = `${origin}/accept-invitation?token=${invite.token}`;
      results.push({ email, status: "invited", invitation_url: url });
    }

    const summary = {
      total: results.length,
      invited: results.filter((r) => r.status === "invited").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
    };

    return new Response(JSON.stringify({ summary, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("import-members error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
