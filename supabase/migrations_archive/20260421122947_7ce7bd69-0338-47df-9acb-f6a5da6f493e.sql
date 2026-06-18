-- Asignar avatares a usuarios ficticios (excluye usuarios reales con avatar ya cargado por upload)
-- Usamos DiceBear (avataaars) que entrega PNG vectorial nítido a cualquier tamaño

UPDATE public.profiles p
SET avatar_url = 'https://api.dicebear.com/7.x/avataaars/png?seed=' || encode(digest(p.user_id::text, 'sha256'), 'hex') || '&size=512&backgroundColor=ffd5dc,c0aede,d1d4f9,b6e3f4,ffdfbf'
WHERE (p.avatar_url IS NULL OR p.avatar_url = '')
  AND p.email LIKE '%@aceplay.cl';
