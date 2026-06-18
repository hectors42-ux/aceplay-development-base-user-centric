import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Gate with SEED_KEY so this endpoint isn't open
  const seedKey = Deno.env.get('SEED_KEY');
  const provided = req.headers.get('x-seed-key');
  if (!seedKey || provided !== seedKey) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const results: Array<{ handle: string; email: string; id: string | null; status: 'created' | 'existing' | 'error'; error?: string }> = [];

  for (let n = 1; n <= 16; n++) {
    const handle = `demo${String(n).padStart(2, '0')}`;
    const email = `${handle}@demo.local`;

    // Try to find existing user by email
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) {
      results.push({ handle, email, id: null, status: 'error', error: listErr.message });
      continue;
    }
    const existing = list.users.find((u) => u.email?.toLowerCase() === email);
    if (existing) {
      results.push({ handle, email, id: existing.id, status: 'existing' });
      continue;
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { handle, display_name: `Demo ${String(n).padStart(2, '0')}` },
    });
    if (error || !data.user) {
      results.push({ handle, email, id: null, status: 'error', error: error?.message ?? 'unknown' });
      continue;
    }
    results.push({ handle, email, id: data.user.id, status: 'created' });
  }

  return new Response(JSON.stringify({ users: results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});