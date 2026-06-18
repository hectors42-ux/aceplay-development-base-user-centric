import { createContext, useContext, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type DateRangePreset = "7d" | "30d" | "mtd" | "90d" | "ytd" | "custom";
export type AnalyticsSport = "todos" | "tenis" | "padel";

export interface AnalyticsFilters {
  preset: DateRangePreset;
  from: Date;
  to: Date;
  sport: AnalyticsSport;
}

interface FiltersContextValue extends AnalyticsFilters {
  setPreset: (preset: DateRangePreset) => void;
  setRange: (from: Date, to: Date) => void;
  setSport: (sport: AnalyticsSport) => void;
}

const FiltersContext = createContext<FiltersContextValue | undefined>(undefined);

function presetToRange(preset: DateRangePreset): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);
  switch (preset) {
    case "7d": from.setDate(now.getDate() - 7); break;
    case "30d": from.setDate(now.getDate() - 30); break;
    case "mtd": from.setDate(1); from.setHours(0, 0, 0, 0); break;
    case "90d": from.setDate(now.getDate() - 90); break;
    case "ytd": from.setMonth(0, 1); from.setHours(0, 0, 0, 0); break;
    default: from.setDate(now.getDate() - 30);
  }
  return { from, to };
}

function parseSport(v: string | null): AnalyticsSport {
  return v === "tenis" || v === "padel" ? v : "todos";
}

export function useAnalyticsFiltersValue(): FiltersContextValue {
  const [params, setParams] = useSearchParams();
  const preset = (params.get("preset") as DateRangePreset) || "30d";
  const fromParam = params.get("from");
  const toParam = params.get("to");
  const sport = parseSport(params.get("sport"));

  const range = useMemo(() => {
    if (preset === "custom" && fromParam && toParam) {
      return { from: new Date(fromParam), to: new Date(toParam) };
    }
    return presetToRange(preset);
  }, [preset, fromParam, toParam]);

  const setPreset = (p: DateRangePreset) => {
    const next = new URLSearchParams(params);
    next.set("preset", p);
    if (p !== "custom") { next.delete("from"); next.delete("to"); }
    setParams(next, { replace: true });
  };

  const setRange = (from: Date, to: Date) => {
    const next = new URLSearchParams(params);
    next.set("preset", "custom");
    next.set("from", from.toISOString());
    next.set("to", to.toISOString());
    setParams(next, { replace: true });
  };

  const setSport = (s: AnalyticsSport) => {
    const next = new URLSearchParams(params);
    if (s === "todos") next.delete("sport"); else next.set("sport", s);
    setParams(next, { replace: true });
  };

  return { preset, from: range.from, to: range.to, sport, setPreset, setRange, setSport };
}

export const AnalyticsFiltersContext = FiltersContext;

export function useAnalyticsFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useAnalyticsFilters must be used within AnalyticsFiltersProvider");
  return ctx;
}
