-- Tabla para persistir notificaciones descartadas por el usuario
CREATE TABLE public.notification_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, ref_id)
);

CREATE INDEX idx_notification_dismissals_user
  ON public.notification_dismissals (user_id);

ALTER TABLE public.notification_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own dismissals"
ON public.notification_dismissals
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dismissals"
ON public.notification_dismissals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dismissals"
ON public.notification_dismissals
FOR DELETE
USING (auth.uid() = user_id);
