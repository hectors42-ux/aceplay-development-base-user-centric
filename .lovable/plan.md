## Tablas de config 1:1 con `space`

Migración única con 3 tablas extensión: `club_profile`, `tournament_config`, `escalerilla_config`. Ninguna toca rating.

### Contenido

1. **Tablas** (PK = `space_id` → `space(id) on delete cascade`):
   - `club_profile`: `branding` jsonb, `legal_name`, `tax_id`, `padron_source`.
   - `tournament_config`: `motor` (enum-as-text), `agendamiento`, `disciplina` (`tennis|padel` con CHECK), `scoring`, `ciclo`, `prestige_mult` default 1.0.
   - `escalerilla_config`: `pyramid` jsonb, `challenge_rules` jsonb, `season_label`.

2. **GRANTs** (requeridos por Supabase, no estaban en tu SQL): `select/insert/update/delete` a `authenticated`, `all` a `service_role`.

3. **RLS habilitada** + las 6 policies que enviaste (lectura por `can_access_space`, escritura por `space_admin`).

### Notas

- `motor` queda como `text not null` sin CHECK (tu SQL solo lo comenta). Si quieres un CHECK estricto con los 6 valores, dímelo.
- `prestige_mult numeric` sin precisión — uso `numeric` puro tal cual escribiste.
- No agrego `created_at/updated_at` porque tu SQL no los pide.

### Fuera de alcance

- Limpieza del código TS roto.
- Tablas de matches, rating, etc.
