import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  isSeasonalTheme,
  isThemeMode,
  normalizeThemeId,
  THEME_DIRTY_KEY,
  THEME_MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  ThemeId,
  ThemeMode,
} from "@/lib/themes";
import {
  DEFAULT_SEASONAL_CALENDAR,
  resolveSeasonalTheme,
  type SeasonalSegment,
  type SurfaceTheme,
} from "@/lib/seasonal-theme";

export type ThemeSyncStatus =
  | "local-only" // sin sesión: solo localStorage
  | "saving"     // escribiendo a profiles
  | "synced"     // local == profiles
  | "pending"    // hay cambios locales sin pushear (offline / falló update)
  | "error";     // último intento devolvió error

interface ThemeCtx {
  /** Elección del usuario (puede ser 'seasonal'). */
  theme: ThemeId;
  /** Superficie efectivamente aplicada (si theme='seasonal', la resuelta por mes). */
  effectiveTheme: ThemeId;
  mode: ThemeMode;
  resolvedDark: boolean;
  setTheme: (t: ThemeId) => void;
  setMode: (m: ThemeMode) => void;
  syncStatus: ThemeSyncStatus;
  lastSyncedAt: number | null;
}

const Ctx = createContext<ThemeCtx | null>(null);

const readInitial = <T,>(key: string, guard: (v: unknown) => v is T, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return guard(v) ? v : fallback;
  } catch {
    return fallback;
  }
};

const safeSet = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
};
const safeDel = (k: string) => {
  try { localStorage.removeItem(k); } catch { /* ignore */ }
};
const isDirty = () => {
  try { return localStorage.getItem(THEME_DIRTY_KEY) === "1"; } catch { return false; }
};

const THEME_CLASSES = [
  "theme-arena", "theme-cement", "theme-clay", "theme-grass",
  "theme-terre-battue", "theme-us-open", "theme-wimbledon",
];

const applyToHtml = (theme: ThemeId, dark: boolean) => {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);
  root.classList.add(`theme-${theme}`);
  root.classList.toggle("dark", dark);
};

const readInitialTheme = (): ThemeId => {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    const normalized = normalizeThemeId(raw);
    if (normalized && normalized !== raw) {
      // Migración silenciosa de valores legacy (p.ej. "etat-francais" → "us-open").
      try { localStorage.setItem(THEME_STORAGE_KEY, normalized); } catch { /* ignore */ }
    }
    return normalized ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => readInitialTheme());
  const [mode, setModeState] = useState<ThemeMode>(() =>
    readInitial(THEME_MODE_STORAGE_KEY, isThemeMode, DEFAULT_MODE),
  );
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );
  const [syncStatus, setSyncStatus] = useState<ThemeSyncStatus>(() =>
    isDirty() ? "pending" : "local-only",
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [seasonalCalendar, setSeasonalCalendar] = useState<SeasonalSegment[]>(DEFAULT_SEASONAL_CALENDAR);
  const [seasonalTick, setSeasonalTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const resolvedDark = mode === "dark" || (mode === "system" && systemDark);

  // Si el usuario eligió 'seasonal', la superficie efectiva se resuelve por mes.
  const effectiveTheme: ThemeId = useMemo(
    () => (isSeasonalTheme(theme) ? (resolveSeasonalTheme(new Date(), seasonalCalendar) as ThemeId) : theme),
    // seasonalTick fuerza re-resolución al cambiar de día / recuperar foco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, seasonalCalendar, seasonalTick],
  );

  useEffect(() => {
    applyToHtml(effectiveTheme, resolvedDark);
  }, [effectiveTheme, resolvedDark]);

  // Re-evaluar el tema estacional al recuperar foco / cambiar de hora.
  useEffect(() => {
    if (!isSeasonalTheme(theme) || typeof window === "undefined") return;
    const bump = () => setSeasonalTick((t) => t + 1);
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", bump);
    const id = window.setInterval(bump, 60 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", bump);
      window.clearInterval(id);
    };
  }, [theme]);

  // Calendario estacional editable por admin (economy_config); fallback al default.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("economy_config")
        .select("value")
        .eq("key", "seasonal_theme_calendar")
        .maybeSingle();
      if (cancelled || !data) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const segs = (data as any).value as unknown;
      if (Array.isArray(segs) && segs.every((s) => s && typeof s.month === "number" && typeof s.theme === "string")) {
        setSeasonalCalendar(segs as SeasonalSegment[]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sync con profiles. Estrategia:
  //  - Si el flag local "dirty" está activo (el usuario cambió algo desde el último sync) → PUSH local → remoto.
  //  - Si NO está dirty → PULL remoto → local (cross-device).
  //  - Tras cualquiera de los dos, limpiamos el flag.
  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user || cancelled) return;

      const localTheme = readInitialTheme();
      const localMode = readInitial(THEME_MODE_STORAGE_KEY, isThemeMode, DEFAULT_MODE);
      const dirty = isDirty();

      setSyncStatus("saving");

      if (dirty) {
        const { error } = await supabase
          .from("profiles")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ theme: localTheme, theme_mode: localMode } as any)
          .eq("id", user.id);
        if (cancelled) return;
        if (error) {
          setSyncStatus("error");
        } else {
          safeDel(THEME_DIRTY_KEY);
          setSyncStatus("synced");
          setLastSyncedAt(Date.now());
        }
        return;
      }

      const { data: prof, error } = await supabase
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("theme, theme_mode" as any)
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setSyncStatus("error");
        return;
      }
      if (prof) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = prof as any;
        const remoteTheme = normalizeThemeId(p.theme);
        if (remoteTheme && remoteTheme !== localTheme) {
          setThemeState(remoteTheme);
          safeSet(THEME_STORAGE_KEY, remoteTheme);
        }
        if (isThemeMode(p.theme_mode) && p.theme_mode !== localMode) {
          setModeState(p.theme_mode);
          safeSet(THEME_MODE_STORAGE_KEY, p.theme_mode);
        }
      }
      setSyncStatus("synced");
      setLastSyncedAt(Date.now());
    };

    sync();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) sync();
      else {
        setSyncStatus(isDirty() ? "pending" : "local-only");
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const persistToProfile = useCallback(
    async (patch: { theme?: ThemeId; theme_mode?: ThemeMode }) => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user) return { ok: false, hasUser: false };
        const { error } = await supabase
          .from("profiles")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(patch as any)
          .eq("id", user.id);
        return { ok: !error, hasUser: true };
      } catch {
        return { ok: false, hasUser: true };
      }
    },
    [],
  );

  const handleWrite = useCallback(
    (patch: { theme?: ThemeId; theme_mode?: ThemeMode }) => {
      safeSet(THEME_DIRTY_KEY, "1");
      setSyncStatus("saving");
      persistToProfile(patch).then(({ ok, hasUser }) => {
        if (!hasUser) {
          setSyncStatus("local-only");
          return;
        }
        if (ok) {
          safeDel(THEME_DIRTY_KEY);
          setSyncStatus("synced");
          setLastSyncedAt(Date.now());
        } else {
          setSyncStatus("error");
        }
      });
    },
    [persistToProfile],
  );

  const setTheme = useCallback(
    (t: ThemeId) => {
      setThemeState(t);
      safeSet(THEME_STORAGE_KEY, t);
      handleWrite({ theme: t });
    },
    [handleWrite],
  );

  const setMode = useCallback(
    (m: ThemeMode) => {
      setModeState(m);
      safeSet(THEME_MODE_STORAGE_KEY, m);
      handleWrite({ theme_mode: m });
    },
    [handleWrite],
  );

  const value = useMemo<ThemeCtx>(
    () => ({ theme, effectiveTheme, mode, resolvedDark, setTheme, setMode, syncStatus, lastSyncedAt }),
    [theme, effectiveTheme, mode, resolvedDark, setTheme, setMode, syncStatus, lastSyncedAt],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useTheme = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used within ThemeProvider");
  return v;
};

export const useThemeToggle = () => {
  const { resolvedDark, setMode } = useTheme();
  return {
    isDark: resolvedDark,
    toggle: () => setMode(resolvedDark ? "light" : "dark"),
  };
};
