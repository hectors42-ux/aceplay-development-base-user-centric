import { useAuth } from "@/components/providers/AuthProvider";

export type MembershipType = "guest" | "trial" | "member";

export function useViewerMembership() {
  const { profile, user } = useAuth();
  const membership_type = ((profile as unknown as { membership_type?: MembershipType })
    ?.membership_type ?? "guest") as MembershipType;
  return {
    user,
    profile,
    membership_type,
    isGuest: membership_type === "guest",
    isTrial: membership_type === "trial",
    isMember: membership_type === "member",
  };
}