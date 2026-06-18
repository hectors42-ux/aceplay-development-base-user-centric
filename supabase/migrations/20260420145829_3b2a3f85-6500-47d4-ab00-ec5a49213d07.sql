
DROP POLICY IF EXISTS "Avatars públicamente legibles" ON storage.objects;

CREATE POLICY "Avatars legibles para autenticados"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
