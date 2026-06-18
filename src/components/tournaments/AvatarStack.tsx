import type { RecentEnrollee } from "@/hooks/useTournamentsList";

function initials(p: RecentEnrollee) {
  return `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase() || "?";
}

export function AvatarStack({
  users,
  total,
}: {
  users: RecentEnrollee[];
  total: number;
}) {
  const more = total - users.length;
  return (
    <div className="flex items-center -space-x-2">
      {users.map((u) => (
        <div
          key={u.user_id + u.registered_at}
          className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-card bg-muted text-[9px] font-semibold text-muted-foreground"
          title={`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()}
        >
          {u.avatar_url ? (
            <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(u)
          )}
        </div>
      ))}
      {more > 0 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-card bg-primary/15 text-[9px] font-semibold text-primary">
          +{more}
        </div>
      )}
    </div>
  );
}
