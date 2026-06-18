import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarRange, Clock3, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  categoryColor,
  MATCH_STATUS_LABEL,
  matchStatusColor,
  roundLabel,
  totalRoundsForMatches,
} from "@/lib/tournament-utils";
import type { Tables } from "@/integrations/supabase/types";

type MatchRow = Tables<"tournament_matches">;
type RegRow = Pick<Tables<"tournament_registrations">, "id" | "player1_user_id" | "player2_user_id">;
type ProfileRow = Pick<Tables<"profiles">, "user_id" | "first_name" | "last_name">;
type CourtRow = Pick<Tables<"courts">, "id" | "name">;
type CategoryRow = Pick<Tables<"tournament_categories">, "id" | "name" | "category_label" | "sort_order">;

interface Props {
  tournamentId: string;
  categoryId?: string;
}

const fmtDay = (iso: string) => format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es });
const fmtTime = (iso: string) => format(parseISO(iso), "HH:mm");

const TBD = "Por definir";

const playerName = (regId: string | null, regs: Map<string, RegRow>, profiles: Map<string, ProfileRow>) => {
  if (!regId) return TBD;
  const r = regs.get(regId);
  if (!r) return TBD;
  const p1 = profiles.get(r.player1_user_id);
  const name1 = p1 ? `${p1.first_name} ${p1.last_name[0] ?? ""}.` : "Jugador";
  if (!r.player2_user_id) return name1;
  const p2 = profiles.get(r.player2_user_id);
  const name2 = p2 ? `${p2.first_name} ${p2.last_name[0] ?? ""}.` : "Jugador";
  return `${name1} / ${name2}`;
};

const PlayerLabel = ({ name, prefix }: { name: string; prefix?: string }) => (
  <p
    className={cn(
      "truncate",
      prefix ? "text-xs" : "text-sm font-medium",
      name === TBD ? "italic text-muted-foreground/70" : prefix ? "text-muted-foreground" : "",
    )}
  >
    {prefix ? `${prefix} ` : ""}
    {name}
  </p>
);

export const TournamentScheduleView = ({ tournamentId, categoryId }: Props) => {
  const showCategoryChips = !categoryId;
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [regs, setRegs] = useState<RegRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [courts, setCourts] = useState<CourtRow[]>([]);
  const [categoriesAll, setCategoriesAll] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      if (categoryId) q = q.eq("tournament_category_id", categoryId);
      const { data: ms } = await q;
      if (cancelled) return;
      const matchList = (ms ?? []) as MatchRow[];
      setMatches(matchList);

      const regIds = Array.from(
        new Set(
          matchList.flatMap((m) => [m.registration_a_id, m.registration_b_id].filter(Boolean) as string[]),
        ),
      );
      const courtIds = Array.from(
        new Set(matchList.map((m) => m.court_id).filter(Boolean) as string[]),
      );

      const [regsRes, courtsRes, catsRes] = await Promise.all([
        regIds.length
          ? supabase
              .from("tournament_registrations")
              .select("id, player1_user_id, player2_user_id")
              .in("id", regIds)
          : Promise.resolve({ data: [] as RegRow[] }),
        courtIds.length
          ? supabase.from("courts").select("id, name").in("id", courtIds)
          : Promise.resolve({ data: [] as CourtRow[] }),
        showCategoryChips
          ? supabase
              .from("tournament_categories")
              .select("id, name, category_label, sort_order")
              .eq("tournament_id", tournamentId)
              .order("sort_order", { ascending: true })
          : Promise.resolve({ data: [] as CategoryRow[] }),
      ]);
      if (cancelled) return;

      const regList = (regsRes.data ?? []) as RegRow[];
      setRegs(regList);
      setCourts((courtsRes.data ?? []) as CourtRow[]);
      setCategoriesAll((catsRes.data ?? []) as CategoryRow[]);

      const userIds = Array.from(
        new Set(
          regList.flatMap((r) => [r.player1_user_id, r.player2_user_id].filter(Boolean) as string[]),
        ),
      );
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles_directory")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);
        if (cancelled) return;
        setProfiles((profs ?? []) as ProfileRow[]);
      } else {
        setProfiles([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, categoryId, showCategoryChips]);

  const regsMap = useMemo(() => new Map(regs.map((r) => [r.id, r])), [regs]);
  const profilesMap = useMemo(() => new Map(profiles.map((p) => [p.user_id, p])), [profiles]);
  const courtsMap = useMemo(() => new Map(courts.map((c) => [c.id, c])), [courts]);
  const categoriesMap = useMemo(
    () =>
      new Map(
        categoriesAll.map((c, idx) => [
          c.id,
          { name: c.name, label: c.category_label, color: categoryColor(idx) },
        ]),
      ),
    [categoriesAll],
  );
  const totalRounds = useMemo(() => totalRoundsForMatches(matches), [matches]);

  // Días disponibles (a partir de todos los partidos cargados)
  const allDays = useMemo(() => {
    const set = new Map<string, Date>();
    for (const m of matches) {
      if (!m.scheduled_at) continue;
      const d = parseISO(m.scheduled_at);
      const key = format(d, "yyyy-MM-dd");
      if (!set.has(key)) set.set(key, d);
    }
    return Array.from(set.entries())
      .sort((a, b) => a[1].getTime() - b[1].getTime())
      .map(([key, date]) => ({ key, date }));
  }, [matches]);

  // Canchas disponibles
  const allCourts = useMemo(() => {
    const ids = Array.from(new Set(matches.map((m) => m.court_id).filter(Boolean) as string[]));
    return ids
      .map((id) => courtsMap.get(id))
      .filter((c): c is CourtRow => !!c)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [matches, courtsMap]);

  // Día N por orden de aparición global (no se reindexa al filtrar)
  const dayIndexByKey = useMemo(
    () => new Map(allDays.map((d, i) => [d.key, i + 1])),
    [allDays],
  );

  // Filtrar y agrupar
  const grouped = useMemo(() => {
    const days: { dayKey: string; date: Date; items: MatchRow[] }[] = [];
    for (const m of matches) {
      if (!m.scheduled_at) continue;
      const d = parseISO(m.scheduled_at);
      const key = format(d, "yyyy-MM-dd");
      if (dayFilter !== "all" && key !== dayFilter) continue;
      if (courtFilter !== "all" && m.court_id !== courtFilter) continue;
      if (showCategoryChips && categoryFilter !== "all" && m.tournament_category_id !== categoryFilter) continue;
      const found = days.find((x) => x.dayKey === key);
      if (found) found.items.push(m);
      else days.push({ dayKey: key, date: d, items: [m] });
    }
    return days;
  }, [matches, dayFilter, courtFilter, categoryFilter, showCategoryChips]);

  const unscheduledCount = useMemo(
    () => matches.filter((m) => !m.scheduled_at).length,
    [matches],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-1.5">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-40" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <CalendarRange className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Aún no hay partidos en esta categoría</p>
        <p className="text-xs text-muted-foreground">
          El cronograma se publica cuando se cierra la inscripción.
        </p>
      </div>
    );
  }

  if (allDays.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <Clock3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          {unscheduledCount} {unscheduledCount === 1 ? "partido pendiente" : "partidos pendientes"} de programación
        </p>
        <p className="text-xs text-muted-foreground">
          Avisaremos cuando se confirmen fecha y cancha.
        </p>
      </div>
    );
  }

  const hasFilters =
    dayFilter !== "all" ||
    courtFilter !== "all" ||
    (showCategoryChips && categoryFilter !== "all");

  const Chip = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip active={dayFilter === "all"} onClick={() => setDayFilter("all")}>
            Todos los días
          </Chip>
          {allDays.map((d) => (
            <Chip
              key={d.key}
              active={dayFilter === d.key}
              onClick={() => setDayFilter(d.key)}
            >
              <span className="capitalize">{format(d.date, "EEE d", { locale: es })}</span>
            </Chip>
          ))}
        </div>
        {allCourts.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip active={courtFilter === "all"} onClick={() => setCourtFilter("all")}>
              Todas las canchas
            </Chip>
            {allCourts.map((c) => (
              <Chip
                key={c.id}
                active={courtFilter === c.id}
                onClick={() => setCourtFilter(c.id)}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        )}
        {showCategoryChips && categoriesAll.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>
              Todas las categorías
            </Chip>
            {categoriesAll.map((c) => {
              const meta = categoriesMap.get(c.id);
              return (
                <Chip
                  key={c.id}
                  active={categoryFilter === c.id}
                  onClick={() => setCategoryFilter(c.id)}
                >
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: meta?.color }}
                    />
                    {c.category_label}
                  </span>
                </Chip>
              );
            })}
          </div>
        )}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
          <p className="text-sm font-medium">Sin partidos con estos filtros</p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setDayFilter("all");
                setCourtFilter("all");
                setCategoryFilter("all");
              }}
              className="mt-2 text-xs font-medium text-primary underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((day) => (
            <section key={day.dayKey} className="space-y-2">
              <header className="flex items-baseline gap-3">
                <h3 className="font-display text-lg font-semibold capitalize">{fmtDay(day.dayKey)}</h3>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Día {dayIndexByKey.get(day.dayKey)}
                </span>
              </header>
              <ul className="space-y-2">
                {day.items.map((m) => {
                  const court = m.court_id ? courtsMap.get(m.court_id) : null;
                  const rl = roundLabel(m.round, totalRounds);
                  const catMeta = showCategoryChips && m.tournament_category_id ? categoriesMap.get(m.tournament_category_id) : null;
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
                    >
                      <div className="w-12 shrink-0 text-center">
                        <p className="font-display text-base font-semibold leading-none">
                          {m.scheduled_at ? fmtTime(m.scheduled_at) : "--:--"}
                        </p>
                        <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                          {rl}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        {catMeta && (
                          <span
                            className="mb-0.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[9px] font-medium"
                            style={{ borderColor: catMeta.color, color: catMeta.color }}
                            title={catMeta.name}
                          >
                            <span
                              className="h-1 w-1 rounded-full"
                              style={{ background: catMeta.color }}
                            />
                            {catMeta.label}
                          </span>
                        )}
                        <PlayerLabel name={playerName(m.registration_a_id, regsMap, profilesMap)} />
                        <PlayerLabel name={playerName(m.registration_b_id, regsMap, profilesMap)} prefix="vs" />
                        <p
                          className={cn(
                            "mt-0.5 flex items-center gap-1 text-[10px]",
                            court ? "text-muted-foreground" : "italic text-muted-foreground/60",
                          )}
                        >
                          <MapPin className="h-3 w-3" /> {court ? court.name : "Cancha por asignar"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          matchStatusColor(m.status),
                        )}
                      >
                        {MATCH_STATUS_LABEL[m.status]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {unscheduledCount > 0 && !hasFilters && (
            <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-3 text-center text-xs text-muted-foreground">
              <Clock3 className="mr-1 inline h-3 w-3 align-[-2px]" />
              {unscheduledCount} {unscheduledCount === 1 ? "partido" : "partidos"} aún sin fecha asignada.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
