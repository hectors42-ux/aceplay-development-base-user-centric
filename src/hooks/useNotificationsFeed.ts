// TODO: cablear fase 2
export type NotificationKind =
  | "club_announcement"
  | "result_proposal"
  | "result_to_load"
  | "reschedule_request"
  | "doubles_invitation"
  | "admin_registration"
  | "ladder_challenge"
  | "ladder_challenge_accepted"
  | "ladder_propose_slots"
  | "ladder_slots_proposed"
  | "ladder_result_pending"
  | "ladder_result"
  | "challenge_expired"
  | "booking_partner"
  | "match_acceptance"
  | "class_invitation"
  | "partner_invitation"
  | "partner_invitation_received"
  | "partner_invitation_accepted"
  | "partner_invitation_rejected"
  | "partner_match_booked"
  | "partner_match_cancelled"
  | "partner_match_reminder"
  | "tournament_match_scheduled"
  | "tournament_streak"
  | "tournament_champion";

export interface NotificationItem {
  kind: NotificationKind;
  ref_id: string;
  title: string;
  description: string;
  link: string;
  created_at: string;
}

export function useNotificationsFeed() {
  // TODO: cablear fase 2
  return {
    items: [] as NotificationItem[],
    loading: false,
    refresh: async () => {},
    total: 0,
  };
}
