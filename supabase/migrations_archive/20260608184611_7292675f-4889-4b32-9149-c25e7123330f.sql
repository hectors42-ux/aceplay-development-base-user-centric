BEGIN;

-- 1. Schema
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ladder_label text NOT NULL DEFAULT 'Pirámide';

COMMENT ON COLUMN public.tenants.ladder_label IS
  'Etiqueta UI para la pirámide del club (default "Pirámide"). Cada tenant puede personalizar: "Staderilla", "Escalera", "Top Liga", etc.';

-- 2. Tenant base
INSERT INTO public.tenants (
  slug, name, short_name,
  brand_primary, brand_primary_glow, brand_primary_deep,
  logo_url, ladder_label
) VALUES (
  'aceplay-demo', 'AcePlay Demo Club', 'AcePlay',
  '16 62% 44%', '22 73% 57%', '13 71% 26%',
  NULL, 'Pirámide'
)
ON CONFLICT (slug) DO UPDATE SET
  name               = EXCLUDED.name,
  short_name         = EXCLUDED.short_name,
  brand_primary      = EXCLUDED.brand_primary,
  brand_primary_glow = EXCLUDED.brand_primary_glow,
  brand_primary_deep = EXCLUDED.brand_primary_deep,
  ladder_label       = EXCLUDED.ladder_label;

-- 3. Limpieza
DO $$
DECLARE
  v_demo_id   uuid;
  v_pilot_ids uuid[];
  v_count     bigint;
BEGIN
  SELECT id INTO v_demo_id FROM public.tenants WHERE slug = 'aceplay-demo';

  SELECT array_agg(id) INTO v_pilot_ids
    FROM public.tenants
   WHERE slug IN ('stade-francais', 'providencia', 'club-providencia')
     AND id <> v_demo_id;

  IF v_pilot_ids IS NULL OR array_length(v_pilot_ids, 1) = 0 THEN
    RAISE NOTICE 'No hay tenants piloto que limpiar. Solo se asegura tenant demo (%).', v_demo_id;
    RETURN;
  END IF;

  RAISE NOTICE 'Tenant demo: %', v_demo_id;
  RAISE NOTICE 'Tenants piloto: %', v_pilot_ids;

  UPDATE public.profiles SET tenant_id = v_demo_id WHERE tenant_id = ANY(v_pilot_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'profiles reasignadas: %', v_count;

  -- Torneos
  DELETE FROM public.tournament_match_results r
   USING public.tournament_matches m, public.tournament_phases p, public.tournaments t
   WHERE r.match_id = m.id AND m.phase_id = p.id AND p.tournament_id = t.id
     AND t.tenant_id = ANY(v_pilot_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'tournament_match_results: %', v_count;

  DELETE FROM public.tournament_match_reschedule_requests r
   USING public.tournament_matches m, public.tournament_phases p, public.tournaments t
   WHERE r.match_id = m.id AND m.phase_id = p.id AND p.tournament_id = t.id
     AND t.tenant_id = ANY(v_pilot_ids);

  DELETE FROM public.tournament_matches m
   USING public.tournament_phases p, public.tournaments t
   WHERE m.phase_id = p.id AND p.tournament_id = t.id AND t.tenant_id = ANY(v_pilot_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'tournament_matches: %', v_count;

  DELETE FROM public.tournament_phases p USING public.tournaments t
   WHERE p.tournament_id = t.id AND t.tenant_id = ANY(v_pilot_ids);

  DELETE FROM public.tournament_registrations r USING public.tournaments t
   WHERE r.tournament_id = t.id AND t.tenant_id = ANY(v_pilot_ids);

  DELETE FROM public.tournament_categories c USING public.tournaments t
   WHERE c.tournament_id = t.id AND t.tenant_id = ANY(v_pilot_ids);

  DELETE FROM public.tournament_courts tc USING public.tournaments t
   WHERE tc.tournament_id = t.id AND t.tenant_id = ANY(v_pilot_ids);

  DELETE FROM public.tournament_alerts a USING public.tournaments t
   WHERE a.tournament_id = t.id AND t.tenant_id = ANY(v_pilot_ids);

  DELETE FROM public.tournaments WHERE tenant_id = ANY(v_pilot_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'tournaments: %', v_count;

  -- Ladders
  DELETE FROM public.ladder_challenge_schedule_proposals p
   USING public.ladder_challenges c, public.ladders l
   WHERE p.challenge_id = c.id AND c.ladder_id = l.id AND l.tenant_id = ANY(v_pilot_ids);

  DELETE FROM public.ladder_history h USING public.ladders l
   WHERE h.ladder_id = l.id AND l.tenant_id = ANY(v_pilot_ids);

  DELETE FROM public.ladder_challenges c USING public.ladders l
   WHERE c.ladder_id = l.id AND l.tenant_id = ANY(v_pilot_ids);

  DELETE FROM public.ladder_positions pos USING public.ladders l
   WHERE pos.ladder_id = l.id AND l.tenant_id = ANY(v_pilot_ids);

  DELETE FROM public.ladders WHERE tenant_id = ANY(v_pilot_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'ladders: %', v_count;

  -- Coaches
  DELETE FROM public.coach_class_bookings b USING public.coach_class_blocks cb
   WHERE b.block_id = cb.id AND cb.tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.coach_class_blocks WHERE tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.coach_payments     WHERE tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.coach_availability a USING public.coach_profiles p
   WHERE a.coach_id = p.id AND p.tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.coach_profiles WHERE tenant_id = ANY(v_pilot_ids);

  -- Reservas y canchas
  DELETE FROM public.bookings      WHERE tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.booking_rules WHERE tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.courts        WHERE tenant_id = ANY(v_pilot_ids);

  -- Partner / match social
  DELETE FROM public.match_post_responses mr USING public.match_open_posts p
   WHERE mr.post_id = p.id AND p.tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.match_open_post_slots ms USING public.match_open_posts p
   WHERE ms.post_id = p.id AND p.tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.match_open_posts      WHERE tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.match_invitations     WHERE tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.match_search_filters  WHERE tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.partner_match_results WHERE tenant_id = ANY(v_pilot_ids);

  DELETE FROM public.match_of_the_week             WHERE tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.suggested_matchup_of_the_week WHERE tenant_id = ANY(v_pilot_ids);

  -- Ratings
  DELETE FROM public.rating_history       WHERE tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.player_ratings       WHERE tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.tenant_rating_config WHERE tenant_id = ANY(v_pilot_ids);

  -- Comunicación / legal
  DELETE FROM public.club_announcements WHERE tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.legal_documents    WHERE tenant_id = ANY(v_pilot_ids);

  -- Invitaciones / analytics
  DELETE FROM public.member_invitations   WHERE tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.analytics_events     WHERE tenant_id = ANY(v_pilot_ids);
  DELETE FROM public.analytics_thresholds WHERE tenant_id = ANY(v_pilot_ids);

  -- Borrar tenants piloto vacíos
  DELETE FROM public.tenants
   WHERE id = ANY(v_pilot_ids)
     AND id NOT IN (SELECT DISTINCT tenant_id FROM public.profiles WHERE tenant_id IS NOT NULL);
  GET DIAGNOSTICS v_count = ROW_COUNT; RAISE NOTICE 'tenants piloto borrados: %', v_count;
END $$;

-- Re-seed legal_documents para tenant demo (esquema real: kind/content_md/version/is_active)
INSERT INTO public.legal_documents (tenant_id, kind, title, content_md, version, is_active)
SELECT t.id, x.kind::legal_doc_kind, x.title, x.content_md, '1.0', true
  FROM public.tenants t,
       (VALUES
         ('terms',       'Términos y Condiciones', 'Términos y Condiciones genéricos de AcePlay. Reemplazar por el texto legal definitivo del club antes de salir a producción.'),
         ('privacy',     'Política de Privacidad', 'Política de Privacidad genérica de AcePlay. Reemplazar por el texto legal definitivo del club antes de salir a producción.'),
         ('user_manual', 'Manual de Usuario',      'Manual de uso genérico de AcePlay. Personalizar con las reglas internas del club.')
       ) AS x(kind, title, content_md)
 WHERE t.slug = 'aceplay-demo'
   AND NOT EXISTS (
     SELECT 1 FROM public.legal_documents ld
      WHERE ld.tenant_id = t.id AND ld.kind = x.kind::legal_doc_kind AND ld.is_active = true
   );

COMMIT;