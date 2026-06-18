UPDATE public.tournaments
SET registration_opens_at = now()
WHERE status = 'inscripciones_abiertas'
  AND registration_opens_at > now();