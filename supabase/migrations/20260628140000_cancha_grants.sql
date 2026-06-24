-- ÉPICA M · Cancha — grants de tabla para las tablas nuevas.
-- En Postgres, las políticas RLS solo aplican DESPUÉS de conceder el privilegio de
-- tabla al rol. Sin estos GRANT, el acceso directo (feed de llamados, bandeja de
-- retos, preferencias de privacidad) da 42501 aunque exista la policy. Las escrituras
-- siguen pasando por RPCs security-definer; estos grants habilitan las LECTURAS del
-- feed/agenda y los upserts de privacidad, ya acotados por las policies.

-- availability_calls: feed visible para todos (SELECT) + insert/update propio (policies).
grant select, insert, update on public.availability_calls to authenticated;

-- challenges: lectura solo para participantes (policy). Escrituras vía RPC.
grant select on public.challenges to authenticated;

-- profile_privacy: lectura/escritura de la propia (policies).
grant select, insert, update on public.profile_privacy to authenticated;

notify pgrst, 'reload schema';
