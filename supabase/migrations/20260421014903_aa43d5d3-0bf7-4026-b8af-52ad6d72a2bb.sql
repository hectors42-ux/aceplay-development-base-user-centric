-- Make avatars bucket public with size and mime restrictions
UPDATE storage.buckets
SET public = true,
    file_size_limit = 2097152, -- 2MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = 'avatars';

-- Drop existing avatar policies if any (idempotent)
DROP POLICY IF EXISTS "Avatars públicos lectura" ON storage.objects;
DROP POLICY IF EXISTS "Usuario sube su avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuario actualiza su avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuario borra su avatar" ON storage.objects;

-- Public read for avatars
CREATE POLICY "Avatars públicos lectura"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- User can upload only into their own folder (first folder = user_id)
CREATE POLICY "Usuario sube su avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Usuario actualiza su avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Usuario borra su avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);