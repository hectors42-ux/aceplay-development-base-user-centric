import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItemSpec {
  id: string;
  label: string;
  icon: LucideIcon;
  fab?: boolean;
}

export interface ArenaBottomNavProps {
  items: NavItemSpec[];
  activeId: string;
  onSelect?: (id: string) => void;
  className?: string;
}

// Bottom-nav PRESENTACIONAL + FAB central (rol ACTION naranja). Sin routing: el
// cableado real vive en src/components/BottomNav.tsx; esta es la primitiva de
// diseño (showcase + base para J). El tab activo y el FAB usan el naranja de acción.
export function ArenaBottomNav({ items, activeId, onSelect, className }: ArenaBottomNavProps) {
  return (
    <nav
      aria-label="Navegación (primitiva Arena)"
      className={cn(
        "flex items-end justify-around rounded-2xl border border-border bg-background/80 px-2 py-2 backdrop-blur-xl",
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === activeId;
        if (item.fab) {
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect?.(item.id)}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center gap-1"
            >
              <span className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-action text-action-foreground shadow-clay ring-4 ring-background transition-transform hover:scale-105">
                <Icon className="h-6 w-6" strokeWidth={2.4} />
              </span>
              <span className={cn("text-[10px] font-semibold", active ? "text-action" : "text-foreground")}>{item.label}</span>
            </button>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors",
              active ? "text-action" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
