
ALTER TABLE public.tournament_categories
  ADD COLUMN IF NOT EXISTS close_mode text NOT NULL DEFAULT 'bracket'
    CHECK (close_mode IN ('bracket','deadline','fixture','continuo')),
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS entry_fee_clp bigint NOT NULL DEFAULT 0 CHECK (entry_fee_clp >= 0),
  ADD COLUMN IF NOT EXISTS prize_allocation jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS home_tenant_id uuid REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS operational_rules jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.tournament_registrations
  ADD COLUMN IF NOT EXISTS fee_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS fee_amount_clp bigint,
  ADD COLUMN IF NOT EXISTS fee_method text
    CHECK (fee_method IS NULL OR fee_method IN ('transferencia','efectivo','exento'));

ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS partial_score jsonb,
  ADD COLUMN IF NOT EXISTS interrupted_at timestamptz,
  ADD COLUMN IF NOT EXISTS resume_deadline_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tournament_categories_close_mode
  ON public.tournament_categories(close_mode, deadline_at);
