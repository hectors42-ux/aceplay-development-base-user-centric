
ALTER TABLE public.match_invitations
  ADD COLUMN IF NOT EXISTS booking_id uuid;

CREATE INDEX IF NOT EXISTS idx_match_invitations_booking ON public.match_invitations(booking_id);
