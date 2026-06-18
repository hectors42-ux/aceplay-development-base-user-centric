// TODO: cablear fase 2
export interface MatchInvitation {
  id: string;
  inviter_user_id: string;
  invitee_user_id: string;
  status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
  proposed_slots: Array<{ starts_at: string; court_id?: string | null }>;
  selected_slot: { starts_at: string; court_id?: string | null } | null;
  message: string | null;
  compat_score: number | null;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
}

export interface InvitationWithProfile extends MatchInvitation {
  counterpart: {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

export const useMatchInvitations = () => {
  // TODO: cablear fase 2
  return {
    received: [] as InvitationWithProfile[],
    sent: [] as InvitationWithProfile[],
    loading: false,
    refresh: (_reason?: string) => {},
  };
};
