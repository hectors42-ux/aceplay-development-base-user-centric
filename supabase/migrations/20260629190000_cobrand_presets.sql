-- Co-branding de club a DATOS: presets configurables (multi-tenant de verdad).
-- Antes vivían hardcodeados en src/lib/cobrand-registry.ts. Ahora un club nuevo
-- se agrega insertando una fila, sin editar código.
-- FIREWALL: solo branding visual; no toca rating/xp/fichas.
create table if not exists public.cobrand_presets (
  brand_key    text primary key,
  display_name text not null,
  eyebrow_text text,
  lockup_text  text,
  flag_country text,
  primary_hex  text not null,
  accent_hex   text not null,
  gradient_css text,
  logo_url     text,
  rights_text  text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.cobrand_presets enable row level security;

-- Lectura pública/autenticada (el preset es branding visible).
drop policy if exists cobrand_presets_read on public.cobrand_presets;
create policy cobrand_presets_read on public.cobrand_presets for select using (true);

-- Escritura solo admin (service_role bypassa RLS).
drop policy if exists cobrand_presets_write on public.cobrand_presets;
create policy cobrand_presets_write on public.cobrand_presets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.cobrand_presets to anon, authenticated;
grant insert, update, delete on public.cobrand_presets to authenticated; -- gated por RLS

-- Seed de los 2 presets existentes: los nombres reales viven en DATOS, no en src/.
insert into public.cobrand_presets
  (brand_key, display_name, eyebrow_text, lockup_text, flag_country, primary_hex, accent_hex, gradient_css, rights_text, active)
values
  ('stade_francais', 'Stade Français', 'Te invita Stade Français', 'ACEPLAY × STADE FRANÇAIS', 'fr',
   '#14213D', '#C8102E', 'linear-gradient(155deg, #14213D 10%, #1E3160 50%, #6a2050 110%)',
   'Stade Français es sponsor oficial. Usa el material institucional al compartir resultados.', true),
  ('pro_trainer', 'Pro Trainer', 'Powered by Pro Trainer', 'ACEPLAY × PRO TRAINER', 'cl',
   '#0B3D2E', '#E0A800', 'linear-gradient(155deg, #0B3D2E 10%, #155840 55%, #7a5a10 110%)', null, true)
on conflict (brand_key) do update set
  display_name = excluded.display_name, eyebrow_text = excluded.eyebrow_text,
  lockup_text = excluded.lockup_text, flag_country = excluded.flag_country,
  primary_hex = excluded.primary_hex, accent_hex = excluded.accent_hex,
  gradient_css = excluded.gradient_css, rights_text = excluded.rights_text,
  active = excluded.active, updated_at = now();

notify pgrst, 'reload schema';
