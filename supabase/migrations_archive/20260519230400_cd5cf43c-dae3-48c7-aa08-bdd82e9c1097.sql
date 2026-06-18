ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS bookings_provider text NOT NULL DEFAULT 'internal'
    CHECK (bookings_provider IN ('internal','external')),
  ADD COLUMN IF NOT EXISTS external_booking_url text;