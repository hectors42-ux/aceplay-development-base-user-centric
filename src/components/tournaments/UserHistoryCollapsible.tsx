import { useState } from "react";
import { Link } from "react-router-dom";
import { History, ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { TournamentListItem } from "@/hooks/useTournamentsList";

export function UserHistoryCollapsible({
  history,
}: {
  history: TournamentListItem[];
}) {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-3xl border border-border bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4 text-muted-foreground" />
          Tu historial · {history.length} torneo{history.length === 1 ? "" : "s"} jugado
          {history.length === 1 ? "" : "s"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <ul className="divide-y divide-border border-t border-border">
          {history.map((t) => (
            <li key={t.id}>
              <Link
                to={`/torneos/${t.slug}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.starts_at ? format(parseISO(t.starts_at), "MMM yyyy", { locale: es }) : "Torneo"}
                    {t.user_past_result ? ` · ${t.user_past_result}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
