import { Skeleton } from "@/components/ui/skeleton";

export const TournamentCardSkeleton = () => (
  <div className="rounded-3xl border border-border bg-card p-4 shadow-card">
    <div className="mb-2 flex items-start justify-between gap-2">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-16 rounded-full" />
    </div>
    <Skeleton className="mb-3 h-3 w-1/2" />
    <div className="flex items-center gap-4">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-20" />
    </div>
  </div>
);
