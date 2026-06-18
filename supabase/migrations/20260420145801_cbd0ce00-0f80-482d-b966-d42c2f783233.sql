
-- ============================================
-- FASE 2: Gamificación (badges + MOTW)
-- ============================================

-- Catálogo de badges/logros
CREATE TYPE public.badge_category AS ENUM ('milestone', 'streak', 'rating', 'social', 'special');

CREATE TABLE public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category public.badge_category NOT NULL DEFAULT 'milestone',
  threshold NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges visibles para autenticados"
  ON public.badges FOR SELECT TO authenticated USING (true);

-- Badges otorgados a usuarios
CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB,
  UNIQUE (user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX idx_user_badges_tenant ON public.user_badges(tenant_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven badges de su club"
  ON public.user_badges FOR SELECT TO authenticated
  USING ((tenant_id = user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona badges"
  ON public.user_badges FOR ALL TO authenticated
  USING (is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

-- Match of the Week (cache semanal)
CREATE TABLE public.match_of_the_week (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('closest', 'upset')),
  source_table TEXT NOT NULL CHECK (source_table IN ('ladder_challenges', 'tournament_matches')),
  source_id UUID NOT NULL,
  player_a_id UUID NOT NULL,
  player_b_id UUID NOT NULL,
  winner_id UUID,
  level_a NUMERIC,
  level_b NUMERIC,
  level_diff NUMERIC,
  score JSONB,
  played_at TIMESTAMPTZ NOT NULL,
  highlight_label TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, week_start, kind)
);

CREATE INDEX idx_motw_tenant_week ON public.match_of_the_week(tenant_id, week_start DESC);

ALTER TABLE public.match_of_the_week ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven MOTW de su club"
  ON public.match_of_the_week FOR SELECT TO authenticated
  USING ((tenant_id = user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona MOTW"
  ON public.match_of_the_week FOR ALL TO authenticated
  USING (is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

-- Función: handicap sugerido entre 2 jugadores (diferencia de nivel UTR)
CREATE OR REPLACE FUNCTION public.suggest_handicap(_user_a UUID, _user_b UUID, _sport rating_sport)
RETURNS TABLE (
  level_a NUMERIC,
  level_b NUMERIC,
  diff NUMERIC,
  suggestion TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH a AS (
    SELECT level FROM player_ratings WHERE user_id = _user_a AND sport = _sport LIMIT 1
  ),
  b AS (
    SELECT level FROM player_ratings WHERE user_id = _user_b AND sport = _sport LIMIT 1
  )
  SELECT
    a.level,
    b.level,
    ABS(a.level - b.level) AS diff,
    CASE
      WHEN ABS(a.level - b.level) < 0.3 THEN 'Partido parejo, sin handicap.'
      WHEN ABS(a.level - b.level) < 0.7 THEN 'El de menor nivel parte 15-0 cada game.'
      WHEN ABS(a.level - b.level) < 1.2 THEN 'El de menor nivel parte 30-0 cada game.'
      WHEN ABS(a.level - b.level) < 1.8 THEN 'El de menor nivel parte 40-0 cada game o jueguen al mejor de 1 set corto.'
      ELSE 'Diferencia muy alta: jueguen sets cortos a 4 games con desempate o pelotitas a media bandeja.'
    END
  FROM a, b;
$$;

-- Función: calcular MOTW de la semana actual (closest + upset)
CREATE OR REPLACE FUNCTION public.compute_match_of_the_week(_tenant_id UUID)
RETURNS SETOF public.match_of_the_week
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start DATE := date_trunc('week', now())::date;
  v_closest RECORD;
  v_upset RECORD;
BEGIN
  -- Borrar la semana actual para recomputar
  DELETE FROM public.match_of_the_week
  WHERE tenant_id = _tenant_id AND week_start = v_week_start;

  -- CLOSEST: el partido jugado esta semana con menor diff de nivel (ladder)
  SELECT
    lc.id AS source_id,
    lc.challenger_user_id AS player_a,
    lc.challenged_user_id AS player_b,
    lc.winner_user_id,
    pra.level AS level_a,
    prb.level AS level_b,
    ABS(pra.level - prb.level) AS diff,
    lc.score,
    lc.played_at
  INTO v_closest
  FROM public.ladder_challenges lc
  JOIN public.player_ratings pra
    ON pra.user_id = lc.challenger_user_id AND pra.sport = 'tenis_singles'
  JOIN public.player_ratings prb
    ON prb.user_id = lc.challenged_user_id AND prb.sport = 'tenis_singles'
  WHERE lc.tenant_id = _tenant_id
    AND lc.played_at >= v_week_start
    AND lc.played_at < v_week_start + INTERVAL '7 days'
    AND lc.winner_user_id IS NOT NULL
  ORDER BY diff ASC, lc.played_at DESC
  LIMIT 1;

  IF v_closest.source_id IS NOT NULL THEN
    INSERT INTO public.match_of_the_week (
      tenant_id, week_start, kind, source_table, source_id,
      player_a_id, player_b_id, winner_id, level_a, level_b, level_diff,
      score, played_at, highlight_label
    ) VALUES (
      _tenant_id, v_week_start, 'closest', 'ladder_challenges', v_closest.source_id,
      v_closest.player_a, v_closest.player_b, v_closest.winner_user_id,
      v_closest.level_a, v_closest.level_b, v_closest.diff,
      v_closest.score, v_closest.played_at,
      'Partido más parejo de la semana'
    );
  END IF;

  -- UPSET: la mayor sorpresa (loser tenía más nivel que winner)
  SELECT
    lc.id AS source_id,
    lc.challenger_user_id AS player_a,
    lc.challenged_user_id AS player_b,
    lc.winner_user_id,
    pra.level AS level_a,
    prb.level AS level_b,
    -- Diferencia favorable al perdedor (positiva = sorpresa real)
    CASE
      WHEN lc.winner_user_id = lc.challenger_user_id THEN prb.level - pra.level
      ELSE pra.level - prb.level
    END AS surprise_gap,
    lc.score,
    lc.played_at
  INTO v_upset
  FROM public.ladder_challenges lc
  JOIN public.player_ratings pra
    ON pra.user_id = lc.challenger_user_id AND pra.sport = 'tenis_singles'
  JOIN public.player_ratings prb
    ON prb.user_id = lc.challenged_user_id AND prb.sport = 'tenis_singles'
  WHERE lc.tenant_id = _tenant_id
    AND lc.played_at >= v_week_start
    AND lc.played_at < v_week_start + INTERVAL '7 days'
    AND lc.winner_user_id IS NOT NULL
    AND (lc.id != COALESCE(v_closest.source_id, '00000000-0000-0000-0000-000000000000'::uuid))
  ORDER BY surprise_gap DESC, lc.played_at DESC
  LIMIT 1;

  IF v_upset.source_id IS NOT NULL AND v_upset.surprise_gap > 0.2 THEN
    INSERT INTO public.match_of_the_week (
      tenant_id, week_start, kind, source_table, source_id,
      player_a_id, player_b_id, winner_id, level_a, level_b, level_diff,
      score, played_at, highlight_label
    ) VALUES (
      _tenant_id, v_week_start, 'upset', 'ladder_challenges', v_upset.source_id,
      v_upset.player_a, v_upset.player_b, v_upset.winner_user_id,
      v_upset.level_a, v_upset.level_b, v_upset.surprise_gap,
      v_upset.score, v_upset.played_at,
      'Sorpresa de la semana'
    );
  END IF;

  RETURN QUERY
  SELECT * FROM public.match_of_the_week
  WHERE tenant_id = _tenant_id AND week_start = v_week_start
  ORDER BY kind;
END;
$$;

-- ============================================
-- FASE 3: Perfil extendido público
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS dominant_hand TEXT CHECK (dominant_hand IN ('right', 'left', 'ambi')),
  ADD COLUMN IF NOT EXISTS backhand TEXT CHECK (backhand IN ('one_handed', 'two_handed')),
  ADD COLUMN IF NOT EXISTS favorite_shot TEXT,
  ADD COLUMN IF NOT EXISTS favorite_surface court_surface,
  ADD COLUMN IF NOT EXISTS playing_style TEXT,
  ADD COLUMN IF NOT EXISTS availability TEXT,
  ADD COLUMN IF NOT EXISTS years_playing INT,
  ADD COLUMN IF NOT EXISTS show_phone BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_email BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_privacy_at TIMESTAMPTZ;

-- Storage bucket para avatares (publico)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars públicamente legibles"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Usuario sube su propio avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuario actualiza su propio avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuario elimina su propio avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- FASE 4: Legal + Comunicaciones admin
-- ============================================

-- Documentos legales / manuales (por tenant + globales)
CREATE TYPE public.legal_doc_kind AS ENUM (
  'terms', 'privacy', 'user_manual', 'rating_explained', 'club_regulation', 'other'
);

CREATE TABLE public.legal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind public.legal_doc_kind NOT NULL,
  title TEXT NOT NULL,
  content_md TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_legal_docs_tenant_kind ON public.legal_documents(tenant_id, kind, is_active);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos leen documentos activos del club o globales"
  ON public.legal_documents FOR SELECT TO authenticated
  USING (
    is_active = true AND (
      tenant_id IS NULL
      OR tenant_id = user_tenant_id(auth.uid())
      OR is_super_admin(auth.uid())
    )
  );

CREATE POLICY "club_admin gestiona docs de su club"
  ON public.legal_documents FOR ALL TO authenticated
  USING (
    tenant_id IS NOT NULL AND is_club_admin_of(auth.uid(), tenant_id)
  )
  WITH CHECK (
    tenant_id IS NOT NULL AND is_club_admin_of(auth.uid(), tenant_id)
  );

CREATE POLICY "super_admin gestiona docs globales"
  ON public.legal_documents FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER trg_legal_docs_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comunicaciones / banners admin para home
CREATE TYPE public.announcement_priority AS ENUM ('info', 'highlight', 'urgent');

CREATE TABLE public.club_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  cta_label TEXT,
  cta_url TEXT,
  priority public.announcement_priority NOT NULL DEFAULT 'info',
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_announcements_tenant_active
  ON public.club_announcements(tenant_id, is_published, starts_at DESC);

ALTER TABLE public.club_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven anuncios vigentes de su club"
  ON public.club_announcements FOR SELECT TO authenticated
  USING (
    is_published = true
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at >= now())
    AND (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  );

CREATE POLICY "club_admin gestiona anuncios de su club"
  ON public.club_announcements FOR ALL TO authenticated
  USING (is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.club_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Catálogo inicial de badges
-- ============================================
INSERT INTO public.badges (code, name, description, icon, category, threshold) VALUES
  ('first_match', 'Primer partido', 'Jugaste tu primer partido oficial', '🎾', 'milestone', 1),
  ('matches_10', '10 partidos', 'Completaste 10 partidos oficiales', '🏆', 'milestone', 10),
  ('matches_50', '50 partidos', 'Veterano del club: 50 partidos', '🥇', 'milestone', 50),
  ('matches_100', '100 partidos', 'Leyenda local: 100 partidos', '👑', 'milestone', 100),
  ('streak_3', 'Racha caliente', '3 victorias seguidas', '🔥', 'streak', 3),
  ('streak_5', 'En llamas', '5 victorias seguidas', '🔥', 'streak', 5),
  ('streak_10', 'Imparable', '10 victorias seguidas', '⚡', 'streak', 10),
  ('giant_slayer', 'Mata-gigantes', 'Venciste a alguien con +1.0 de nivel', '🗡️', 'special', NULL),
  ('top_10', 'Top 10', 'Entraste al top 10 del club', '⭐', 'rating', 10),
  ('top_3', 'Podio', 'Llegaste al podio del club', '🏅', 'rating', 3),
  ('club_champion', 'Campeón del club', '#1 del ranking del club', '👑', 'rating', 1),
  ('rating_consolidated', 'Nivel consolidado', 'Confiabilidad ≥ 70%', '✅', 'rating', 70),
  ('social_butterfly', 'Mariposa social', 'Jugaste con 10 rivales distintos', '🦋', 'social', 10);

-- ============================================
-- Documentos legales por defecto (globales)
-- ============================================
INSERT INTO public.legal_documents (tenant_id, kind, title, content_md, version) VALUES
(NULL, 'terms', 'Términos y condiciones de uso', E'# Términos y condiciones\n\n**Última actualización:** Abril 2026\n\n## 1. Aceptación\nAl usar AcePlay aceptas estos términos. Si no estás de acuerdo, no uses la plataforma.\n\n## 2. Uso de la plataforma\nAcePlay es una herramienta de gestión deportiva para clubes y sus socios. La plataforma se ofrece "tal cual", sin garantías de disponibilidad ininterrumpida.\n\n## 3. Cuenta de usuario\nEres responsable de mantener la confidencialidad de tu cuenta y de toda actividad que ocurra bajo ella.\n\n## 4. Conducta\nNo está permitido:\n- Suplantar identidad\n- Subir contenido ofensivo, ilegal o difamatorio\n- Manipular resultados o rankings\n- Intentar vulnerar la seguridad del sistema\n\n## 5. Propiedad intelectual\nEl software, marca y diseño son propiedad de AcePlay. El contenido subido por usuarios sigue siendo de su autoría, pero otorgan licencia a AcePlay para mostrarlo dentro de la plataforma.\n\n## 6. Limitación de responsabilidad\nAcePlay no es responsable por:\n- Lesiones o accidentes durante partidos coordinados a través de la app\n- Disputas entre socios\n- Pérdida de datos por causas externas (fallas de proveedores, etc.)\n\nLa responsabilidad máxima de AcePlay se limita al monto pagado en los últimos 12 meses.\n\n## 7. Modificaciones\nAcePlay puede modificar estos términos. Notificaremos cambios materiales con 15 días de anticipación.\n\n## 8. Ley aplicable\nEstos términos se rigen por las leyes de Chile. Cualquier disputa se resuelve en los tribunales de Santiago.\n\n## 9. Contacto\nsoporte@aceplay.app', '1.0'),
(NULL, 'privacy', 'Política de privacidad', E'# Política de privacidad\n\n**Última actualización:** Abril 2026\n\nAcePlay cumple con la Ley N° 19.628 de Protección de la Vida Privada de Chile y se prepara para la nueva Ley de Protección de Datos Personales en trámite en el Congreso.\n\n## 1. Datos que recopilamos\n- **De tu cuenta:** nombre, email, teléfono, RUT, fecha de nacimiento, foto.\n- **De tu actividad deportiva:** rating, historial de partidos, reservas, posición en rankings.\n- **Técnicos:** IP, tipo de dispositivo, registro de accesos.\n\n## 2. Para qué los usamos\n- Operar el club al que perteneces\n- Calcular tu rating y rankings\n- Gestionar reservas y torneos\n- Enviarte notificaciones operacionales (no promocionales sin tu consentimiento)\n\n## 3. Quién ve tus datos\n- **Otros socios del club:** ven tu nombre, foto, nivel y los datos que tú elijas hacer públicos en tu perfil.\n- **Administradores del club:** ven todos tus datos para fines de gestión.\n- **Otros clubes:** NO ven tus datos. Cada club opera de forma aislada.\n- **Terceros:** solo proveedores de infraestructura (hosting, email transaccional) bajo acuerdos de confidencialidad.\n\n## 4. Tus derechos\nPuedes en cualquier momento:\n- **Acceder** a tus datos desde tu perfil\n- **Rectificar** información incorrecta\n- **Eliminar** tu cuenta (datos anonimizados, no borrados, para mantener integridad de rankings históricos)\n- **Oponerte** a tratamientos específicos\n- **Portabilidad:** solicitar tus datos en formato JSON\n\n## 5. Seguridad\n- Cifrado en tránsito (HTTPS) y en reposo\n- Acceso por roles\n- Backups diarios\n- Auditoría de accesos administrativos\n\n## 6. Conservación\nMantenemos tus datos mientras tu cuenta esté activa. Tras eliminarla, conservamos información agregada y anonimizada por motivos estadísticos.\n\n## 7. Menores de edad\nMenores de 14 años requieren consentimiento de su tutor. El club es responsable de validar esto al inscribir al socio.\n\n## 8. Cookies\nUsamos cookies estrictamente necesarias para autenticación. No usamos cookies publicitarias ni de tracking de terceros.\n\n## 9. Contacto del responsable\nResponsable de datos: AcePlay SpA\nEmail: privacidad@aceplay.app\n\nEn caso de no obtener respuesta, puedes dirigirte a la Agencia de Protección de Datos correspondiente.', '1.0'),
(NULL, 'user_manual', 'Manual de uso', E'# Manual de uso AcePlay\n\n## 🏠 Inicio\nDesde el home accedes a:\n- **Acciones pendientes:** desafíos por responder, resultados por confirmar.\n- **Próxima reserva:** tu próximo partido con foto y detalle.\n- **Rating:** tu nivel actual y categoría.\n- **Atajos:** reservar, torneos, ranking.\n\n## 📅 Reservar cancha\n1. Toca **Reservar** en el menú inferior.\n2. Elige fecha, cancha y horario disponible.\n3. Selecciona tu compañero (socio del club).\n4. Confirma. Llegará notificación a ambos.\n\n**Reglas:** puedes cancelar hasta 4h antes sin penalización.\n\n## 🏆 Torneos\n- Inscríbete en categorías abiertas.\n- En dobles, invita a tu pareja: ella debe aceptar para confirmarte.\n- Cuando juegues, propones el resultado y tu rival lo confirma.\n\n## 📈 Ranking\n- **Ranking del club:** estilo UTR, basado en partidos jugados.\n- **Pirámide:** modo social de retos. Subes posiciones desafiando.\n- **Mi evolución:** tu historial gráfico.\n\n## 👤 Perfil\n- Edita tu bio, mano dominante, golpe favorito, disponibilidad.\n- Configura qué datos son visibles para el resto del club.\n- Sube tu foto.\n\n## 🔔 Notificaciones\nLa campanita arriba muestra todo lo que requiere tu atención: invitaciones, propuestas de resultado, anuncios del club.', '1.0'),
(NULL, 'rating_explained', '¿Cómo se calcula mi nivel?', E'# Cómo se calcula tu nivel\n\nAcePlay usa un sistema **estilo UTR** (Universal Tennis Rating) adaptado al club.\n\n## 📏 La escala\nVa de **0.00 a 7.00**:\n- **0–1.5:** iniciación\n- **1.5–2.5:** intermedio bajo\n- **2.5–3.5:** intermedio\n- **3.5–4.5:** intermedio alto\n- **4.5–5.5:** intermedio avanzado\n- **5.5–7.0:** competición\n\n## 🧮 Cómo cambia\nDespués de cada partido oficial, tu nivel se ajusta según:\n1. **Resultado** (ganaste/perdiste)\n2. **Diferencia de nivel con tu rival** (ganarle a alguien más fuerte sube más)\n3. **Score** (un 6-1 mueve más que un 7-6)\n4. **Tu confiabilidad** (cuánto sabe el sistema de ti)\n\n## ✅ Confiabilidad\nEs un porcentaje (0–100) que indica qué tan calibrado está tu nivel:\n- Empiezas en **15%** tras el cuestionario.\n- Sube ~4% cada partido.\n- Baja si llevas mucho tiempo sin jugar.\n\n**Con confiabilidad ≥ 30%** apareces en el ranking principal.\n**Bajo eso** apareces en "En calibración".\n\n## 🏷️ Categorías\nEl club define umbrales para A, B, C según tu nivel actual.\n\n## 🎮 Singles vs Dobles\nSon ratings **independientes**. Tu nivel de singles no afecta tu nivel de dobles ni viceversa.\n\n## 🔄 Pirámide vs Ranking\n- **Ranking** = nivel objetivo, basado en TODOS tus partidos.\n- **Pirámide** = juego social de posiciones. Los partidos de pirámide también suman al ranking.\n\n## ❓ Preguntas frecuentes\n**¿Por qué bajé si gané?** No bajas si ganas. Si gana alguien de mucho menor nivel, sube poco; si gana alguien de mucho mayor nivel, sube bastante.\n\n**¿Puedo bajar mi nivel manualmente?** Sí, desde tu perfil, si crees que el sistema te sobreestima.\n\n**¿Cuánto tarda en estabilizarse?** Entre 8 y 15 partidos competitivos.', '1.0');
