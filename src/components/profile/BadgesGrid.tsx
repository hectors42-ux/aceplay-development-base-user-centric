import { useState } from "react";
import { ChevronRight, Lock, Sparkles, Trophy } from "lucide-react";
import { useUserBadges, type Badge } from "@/hooks/useUserBadges";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  userId: string;
  showLocked?: boolean;
}

const CATEGORY_WEIGHT: Record<string, number> = {
  milestone: 0,
  social: 1,
  streak: 2,
  rating: 3,
  special: 4,
};

const priorityScore = (b: Badge) => {
  const cat = CATEGORY_WEIGHT[b.category] ?? 5;
  const threshold = b.threshold ?? 999;
  return cat * 1000 + threshold;
};

const Medal = ({ badge, locked, highlight }: { badge: Badge; locked?: boolean; highlight?: boolean }) => (
  <div className="flex w-[68px] shrink-0 flex-col items-center gap-1 text-center">
    <div
      className={cn(
        "relative flex h-16 w-16 items-center justify-center rounded-full text-3xl leading-none shadow-card transition-smooth",
        locked
          ? highlight
            ? "border border-dashed border-primary/40 bg-primary/5 grayscale-[0.4] opacity-90"
            : "border border-dashed border-border bg-muted/40 grayscale opacity-70"
          : "bg-gradient-to-br from-primary/15 via-accent/15 to-primary/5 ring-1 ring-primary/30",
      )}
    >
      <span aria-hidden>{badge.icon}</span>
      {locked && (
        <Lock className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-background p-0.5 text-muted-foreground" />
      )}
      {highlight && (
        <span className="absolute -top-1 -right-1 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary-foreground">
          <Sparkles className="h-2 w-2" />
        </span>
      )}
    </div>
    <p
      className={cn(
        "line-clamp-2 text-[10px] font-semibold leading-tight",
        locked ? "text-muted-foreground" : "text-foreground",
      )}
    >
      {badge.name}
    </p>
  </div>
);

export const BadgesGrid = ({ userId, showLocked = true }: Props) => {
  const { items, allBadges, loading } = useUserBadges(userId);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (loading) {
    return <Skeleton className="h-28 w-full rounded-2xl" />;
  }

  const earnedIds = new Set(items.map((i) => i.badge_id));
  const earned = items
    .map((i) => i.badge)
    .filter((b): b is NonNullable<typeof b> => Boolean(b));
  const locked = allBadges
    .filter((b) => !earnedIds.has(b.id))
    .sort((a, b) => priorityScore(a) - priorityScore(b));
  const featuredLocked = locked.slice(0, 3);

  const total = allBadges.length;

  return (
    <>
      <div className="rounded-3xl border border-border bg-card p-3 shadow-card">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Trophy className="mr-1 inline h-3 w-3" />
            {earned.length} de {total}
          </p>
          {showLocked && total > 0 && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-primary transition-smooth hover:bg-primary/10"
            >
              Ver todas
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="-mx-3 overflow-x-auto px-3 pt-2 pb-1 scrollbar-none">
          <div className="flex gap-2.5">
            {earned.length === 0 && featuredLocked.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                Aún sin logros disponibles.
              </p>
            ) : earned.length === 0 ? (
              <>
                {featuredLocked.map((b) => (
                  <Medal key={b.id} badge={b} locked highlight />
                ))}
                <div className="flex w-[120px] shrink-0 items-center justify-center px-2 text-[10px] italic text-muted-foreground">
                  Tu primera medalla está cerca ✨
                </div>
              </>
            ) : (
              <>
                {earned.map((b) => (
                  <Medal key={b.id} badge={b} />
                ))}
                {featuredLocked.slice(0, 2).map((b) => (
                  <Medal key={b.id} badge={b} locked highlight />
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] overflow-hidden p-0">
          <div className="mx-auto flex h-full max-w-md flex-col">
            <SheetHeader className="border-b border-border p-4 pr-10 text-left">
              <SheetTitle className="font-display text-base">Todas las medallas</SheetTitle>
              <p className="text-[11px] text-muted-foreground">
                {earned.length} desbloqueadas · {locked.length} por desbloquear
              </p>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {earned.length > 0 && (
                <section>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Desbloqueadas · {earned.length}
                  </p>
                  <ul className="grid grid-cols-3 gap-3">
                    {earned.map((b) => (
                      <li
                        key={b.id}
                        className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-accent/5 p-3 text-center"
                      >
                        <span className="text-3xl leading-none">{b.icon}</span>
                        <p className="text-xs font-semibold leading-tight text-foreground">
                          {b.name}
                        </p>
                        <p className="text-[10px] leading-snug text-muted-foreground">
                          {b.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {locked.length > 0 && (
                <section>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Por desbloquear · {locked.length}
                  </p>
                  <ul className="space-y-2">
                    {locked.map((b, idx) => {
                      const highlight = idx < 3;
                      return (
                        <li
                          key={b.id}
                          className={cn(
                            "flex items-start gap-3 rounded-2xl border border-dashed p-3",
                            highlight
                              ? "border-primary/30 bg-primary/5"
                              : "border-border bg-muted/30 opacity-80",
                          )}
                        >
                          <span className="relative text-2xl leading-none grayscale">
                            {b.icon}
                            <Lock className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-muted-foreground" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p
                                className={cn(
                                  "text-sm font-semibold leading-tight",
                                  highlight ? "text-foreground" : "text-muted-foreground",
                                )}
                              >
                                {b.name}
                              </p>
                              {highlight && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                                  <Sparkles className="h-2.5 w-2.5" />
                                  Cerca
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                              {b.description}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
