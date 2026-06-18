CREATE POLICY "mi_parties_delete_old"
ON public.match_invitations
FOR DELETE
TO authenticated
USING (
  (inviter_user_id = auth.uid() OR invitee_user_id = auth.uid())
  AND status <> 'pending'
);