
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE TABLE public.user_challenge_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_week_start date,
  last_challenge_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
ALTER TABLE public.user_challenge_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Socio ve su propia racha o admin del club"
  ON public.user_challenge_streaks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_club_admin_of(auth.uid(), tenant_id));
CREATE POLICY "club_admin gestiona rachas"
  ON public.user_challenge_streaks FOR ALL TO authenticated
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));
CREATE TRIGGER trg_streak_touch_updated_at
BEFORE UPDATE ON public.user_challenge_streaks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.suggested_matchup_of_the_week (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  player_a_id uuid NOT NULL,
  player_b_id uuid NOT NULL,
  level_a numeric, level_b numeric, level_diff numeric,
  score numeric NOT NULL DEFAULT 0,
  reason text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, week_start)
);
ALTER TABLE public.suggested_matchup_of_the_week ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Socios ven matchup sugerido del club"
  ON public.suggested_matchup_of_the_week FOR SELECT TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "club_admin gestiona matchups sugeridos"
  ON public.suggested_matchup_of_the_week FOR ALL TO authenticated
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

INSERT INTO public.badges (code, name, description, icon, category, threshold) VALUES
  ('retador_activo', 'Retador activo', 'Lanzaste tu primer desafío del mes en la pirámide.', '⚔️', 'social', 1),
  ('racha_3_semanas', 'Racha de retos', '3 semanas seguidas lanzando al menos un desafío.', '🔥', 'streak', 3)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_challengeable_players(_ladder_id uuid)
RETURNS TABLE (
  user_id uuid, pos integer, first_name text, last_name text, avatar_url text,
  level numeric, level_diff numeric, last_played_at timestamptz,
  schedule_match boolean, rematch boolean, cooldown_blocked boolean, score numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _ladder ladders%ROWTYPE;
  _my_pos ladder_positions%ROWTYPE;
  _my_rating numeric;
  _my_avail text;
BEGIN
  IF _me IS NULL THEN RETURN; END IF;
  SELECT * INTO _ladder FROM ladders WHERE id = _ladder_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO _my_pos FROM ladder_positions
    WHERE ladder_id = _ladder_id AND ladder_positions.user_id = _me;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT pr.level INTO _my_rating
  FROM player_ratings pr
  WHERE pr.user_id = _me
    AND pr.sport = (CASE WHEN _ladder.discipline = 'tenis_dobles'
                          THEN 'tenis_dobles'::rating_sport
                          ELSE 'tenis_singles'::rating_sport END)
  LIMIT 1;
  _my_rating := COALESCE(_my_rating, 0);

  SELECT availability INTO _my_avail FROM profiles WHERE profiles.user_id = _me;

  RETURN QUERY
  WITH last_match AS (
    SELECT
      CASE WHEN c.challenger_user_id = _me THEN c.challenged_user_id ELSE c.challenger_user_id END AS opponent,
      MAX(c.played_at) AS last_played
    FROM ladder_challenges c
    WHERE c.ladder_id = _ladder_id
      AND c.played_at IS NOT NULL
      AND (_me IN (c.challenger_user_id, c.challenged_user_id))
    GROUP BY 1
  ),
  pending AS (
    SELECT DISTINCT
      CASE WHEN c.challenger_user_id = _me THEN c.challenged_user_id ELSE c.challenger_user_id END AS opponent
    FROM ladder_challenges c
    WHERE c.ladder_id = _ladder_id
      AND c.status IN ('propuesto','aceptado','programado')
      AND (_me IN (c.challenger_user_id, c.challenged_user_id))
  ),
  grudge AS (
    SELECT
      CASE WHEN c.challenger_user_id = _me THEN c.challenged_user_id ELSE c.challenger_user_id END AS opponent
    FROM ladder_challenges c
    WHERE c.ladder_id = _ladder_id
      AND c.played_at IS NOT NULL
      AND c.loser_user_id = _me
      AND _me IN (c.challenger_user_id, c.challenged_user_id)
    GROUP BY 1
  )
  SELECT
    lp.user_id,
    lp.position AS pos,
    p.first_name, p.last_name, p.avatar_url,
    COALESCE(pr.level, 0)::numeric AS level,
    ABS(COALESCE(pr.level, 0) - _my_rating)::numeric AS level_diff,
    lm.last_played AS last_played_at,
    (
      _my_avail IS NOT NULL AND p.availability IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM regexp_split_to_table(lower(_my_avail), '[^a-z0-9áéíóú]+') t1
        WHERE length(t1) >= 4
          AND t1 IN (SELECT regexp_split_to_table(lower(p.availability), '[^a-z0-9áéíóú]+'))
      )
    ) AS schedule_match,
    (gr.opponent IS NOT NULL) AS rematch,
    (
      lm.last_played IS NOT NULL
      AND lm.last_played > now() - make_interval(days => _ladder.cooldown_days)
    ) AS cooldown_blocked,
    (
      35.0 * GREATEST(0, 1 - LEAST(ABS(COALESCE(pr.level,0) - _my_rating), 1.5) / 1.5)
      + 25.0 * (CASE
                  WHEN lp.last_played_at IS NULL THEN 0.3
                  WHEN lp.last_played_at > now() - interval '14 days' THEN 1.0
                  WHEN lp.last_played_at > now() - interval '30 days' THEN 0.6
                  ELSE 0.2 END)
      + 25.0 * (CASE WHEN
                  _my_avail IS NOT NULL AND p.availability IS NOT NULL
                  AND EXISTS (
                    SELECT 1 FROM regexp_split_to_table(lower(_my_avail), '[^a-z0-9áéíóú]+') t1
                    WHERE length(t1) >= 4
                      AND t1 IN (SELECT regexp_split_to_table(lower(p.availability), '[^a-z0-9áéíóú]+'))
                  ) THEN 1 ELSE 0 END)
      + 15.0 * (CASE WHEN gr.opponent IS NOT NULL THEN 1 ELSE 0 END)
    )::numeric AS score
  FROM ladder_positions lp
  JOIN profiles p ON p.user_id = lp.user_id
  LEFT JOIN player_ratings pr ON pr.user_id = lp.user_id
       AND pr.sport = (CASE WHEN _ladder.discipline = 'tenis_dobles'
                             THEN 'tenis_dobles'::rating_sport
                             ELSE 'tenis_singles'::rating_sport END)
  LEFT JOIN last_match lm ON lm.opponent = lp.user_id
  LEFT JOIN grudge gr ON gr.opponent = lp.user_id
  WHERE lp.ladder_id = _ladder_id
    AND lp.user_id <> _me
    AND lp.status = 'activo'
    AND lp.position < _my_pos.position
    AND (_my_pos.position - lp.position) <= _ladder.max_position_jump
    AND NOT EXISTS (SELECT 1 FROM pending pe WHERE pe.opponent = lp.user_id)
    AND (
      lm.last_played IS NULL
      OR lm.last_played <= now() - make_interval(days => _ladder.cooldown_days)
    )
  ORDER BY score DESC, level_diff ASC
  LIMIT 20;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_challengeable_players(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.compute_suggested_matchup(_tenant_id uuid)
RETURNS public.suggested_matchup_of_the_week
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _week_start date := date_trunc('week', now())::date;
  _row suggested_matchup_of_the_week%ROWTYPE;
BEGIN
  WITH active_players AS (
    SELECT pr.user_id, pr.level
    FROM player_ratings pr
    WHERE pr.tenant_id = _tenant_id
      AND pr.sport = 'tenis_singles'
      AND pr.reliability >= 30
      AND pr.last_match_at > now() - interval '45 days'
  ),
  pairs AS (
    SELECT a.user_id AS pa, b.user_id AS pb,
           a.level AS la, b.level AS lb,
           ABS(a.level - b.level) AS diff
    FROM active_players a
    JOIN active_players b ON a.user_id < b.user_id
    WHERE ABS(a.level - b.level) <= 0.4
  ),
  best AS (SELECT * FROM pairs ORDER BY diff ASC, random() LIMIT 1)
  INSERT INTO suggested_matchup_of_the_week
    (tenant_id, week_start, player_a_id, player_b_id, level_a, level_b, level_diff, score, reason)
  SELECT _tenant_id, _week_start, pa, pb, la, lb, diff,
         (100 - diff*100)::numeric,
         'Emparejamiento más equilibrado del club esta semana'
  FROM best
  ON CONFLICT (tenant_id, week_start) DO UPDATE
    SET player_a_id = EXCLUDED.player_a_id,
        player_b_id = EXCLUDED.player_b_id,
        level_a = EXCLUDED.level_a,
        level_b = EXCLUDED.level_b,
        level_diff = EXCLUDED.level_diff,
        score = EXCLUDED.score,
        reason = EXCLUDED.reason,
        computed_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.compute_suggested_matchup(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_challenge_gamification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _week_start date := date_trunc('week', now())::date;
  _streak user_challenge_streaks%ROWTYPE;
  _new_current integer := 1;
  _badge_id uuid;
  _first_this_month boolean;
BEGIN
  SELECT * INTO _streak FROM user_challenge_streaks
  WHERE tenant_id = NEW.tenant_id AND user_id = NEW.challenger_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_challenge_streaks
      (tenant_id, user_id, current_streak, longest_streak, last_week_start, last_challenge_at)
    VALUES (NEW.tenant_id, NEW.challenger_user_id, 1, 1, _week_start, now());
    _new_current := 1;
  ELSE
    IF _streak.last_week_start = _week_start THEN
      _new_current := _streak.current_streak;
    ELSIF _streak.last_week_start = (_week_start - interval '7 days')::date THEN
      _new_current := _streak.current_streak + 1;
    ELSE
      _new_current := 1;
    END IF;
    UPDATE user_challenge_streaks
    SET current_streak = _new_current,
        longest_streak = GREATEST(longest_streak, _new_current),
        last_week_start = _week_start,
        last_challenge_at = now(),
        updated_at = now()
    WHERE id = _streak.id;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM ladder_challenges c
    WHERE c.challenger_user_id = NEW.challenger_user_id
      AND c.tenant_id = NEW.tenant_id
      AND c.id <> NEW.id
      AND date_trunc('month', c.created_at) = date_trunc('month', NEW.created_at)
  ) INTO _first_this_month;

  IF _first_this_month THEN
    SELECT id INTO _badge_id FROM badges WHERE code = 'retador_activo';
    IF _badge_id IS NOT NULL THEN
      INSERT INTO user_badges (tenant_id, user_id, badge_id, context)
      VALUES (NEW.tenant_id, NEW.challenger_user_id, _badge_id,
              jsonb_build_object('challenge_id', NEW.id, 'month', to_char(NEW.created_at, 'YYYY-MM')));
    END IF;
  END IF;

  IF _new_current >= 3 THEN
    SELECT id INTO _badge_id FROM badges WHERE code = 'racha_3_semanas';
    IF _badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM user_badges
      WHERE user_id = NEW.challenger_user_id
        AND tenant_id = NEW.tenant_id
        AND badge_id = _badge_id
    ) THEN
      INSERT INTO user_badges (tenant_id, user_id, badge_id, context)
      VALUES (NEW.tenant_id, NEW.challenger_user_id, _badge_id,
              jsonb_build_object('streak', _new_current));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenge_gamification ON public.ladder_challenges;
CREATE TRIGGER trg_challenge_gamification
AFTER INSERT ON public.ladder_challenges
FOR EACH ROW EXECUTE FUNCTION public.handle_challenge_gamification();

CREATE INDEX IF NOT EXISTS idx_streaks_tenant_user ON public.user_challenge_streaks(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_smotw_tenant_week ON public.suggested_matchup_of_the_week(tenant_id, week_start DESC);
