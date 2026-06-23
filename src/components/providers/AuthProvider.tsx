import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { markRatingOnboardingDone } from "@/lib/onboarding";

export type AppRole =
  | "super_admin"
  | "club_admin"
  | "staff"
  | "member"
  | "coach"
  | "organizador";

export interface UserProfile {
  id: string;
  user_id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  rut: string | null;
  phone: string | null;
  avatar_url: string | null;
  avatar_kind: string;
  avatar_look: string;
  birthdate: string | null;
  ntrp_level: number | null;
  club_ranking: number | null;
  dues_status: "al_dia" | "pendiente" | "moroso" | "suspendido";
  member_since: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isCoach: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isCoach, setIsCoach] = useState(false);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  // Trackea el último user_id procesado para detectar cambios de cuenta
  // y limpiar el cache de React Query (evita ver datos del usuario anterior).
  const lastUserIdRef = useRef<string | null>(null);

  const fetchProfileAndRoles = async (userId: string) => {
    const [profileRes, rolesRes, coachRes] = await Promise.all([
      // profiles del core player-first: PK es `id` (= auth.users.id), no `user_id`.
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      // user_roles / coach_profiles aún no portados al core: fallan silenciosamente (data null).
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("coach_profiles")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    // El profile del core trae `display_name`/`handle`; lo adaptamos al shape UserProfile
    // (first_name/last_name) que consume la app, sin restaurar el modelo viejo (tenant_id, etc.).
    const row = profileRes.data as Record<string, unknown> | null;
    setProfile(
      row
        ? ({
            id: row.id as string,
            user_id: row.id as string,
            tenant_id: "",
            email: "",
            first_name:
              ((row.display_name as string) || (row.handle as string) || "Socio").split(" ")[0],
            last_name: ((row.display_name as string) || "").split(" ").slice(1).join(" "),
            rut: (row.rut as string) ?? null,
            phone: null,
            avatar_url: (row.avatar_url as string) ?? null,
            avatar_kind: (row.avatar_kind as string) ?? "rally",
            avatar_look: (row.avatar_look as string) ?? "classic",
            birthdate: (row.birthdate as string) ?? null,
            ntrp_level: null,
            club_ranking: null,
            dues_status: "al_dia",
            member_since: row.created_at as string,
          } as UserProfile)
        : null,
    );
    setRoles(((rolesRes.data ?? []) as { role: AppRole }[]).map((r) => r.role));
    setIsCoach(!!coachRes.data);
  };

  // Prefetch agresivo justo después del login: cargamos en paralelo el
  // resumen de perfil (lo que pinta Home) y resolvemos el chequeo de
  // onboarding para que ProtectedRoute no tenga que esperar al RPC en la
  // primera navegación. Resultado: Home aparece prácticamente al instante.
  const prefetchPostLogin = (userId: string) => {
    // Profile summary → cache de React Query con la misma queryKey que usa
    // useUserProfileSummary("tenis_singles").
    queryClient
      .prefetchQuery({
        queryKey: ["profile-summary", userId, "tenis_singles"],
        queryFn: async () => {
          const { data, error } = await supabase.rpc("user_profile_summary", {
            _user_id: userId,
            _sport: "tenis_singles",
          });
          if (error) throw error;
          return data;
        },
        staleTime: 30_000,
      })
      .catch(() => {
        // silencioso: el hook reintentará al montarse
      });

    // Onboarding check → si ya está completo, lo marcamos en sessionStorage
    // para que ProtectedRoute lo lea sincrónicamente sin gate de loading.
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("has_completed_rating_onboarding", {
          _user_id: userId,
        });
        if (!error && Boolean(data)) markRatingOnboardingDone(userId);
      } catch {
        // silencioso: ProtectedRoute hace su propio reintento
      }
    })();
  };

  useEffect(() => {
    let initialized = false;

    // 1) Listener PRIMERO (sin async dentro del callback)
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      const newUserId = newSession?.user?.id ?? null;
      const prevUserId = lastUserIdRef.current;

      // Solo limpiar cache cuando REALMENTE cambia el usuario (logout, o login
      // con otra cuenta). NO en la primera carga (prev=null, llega INITIAL_SESSION
      // con el mismo user persistido) ni en TOKEN_REFRESHED del mismo usuario.
      // Antes hacíamos clear() en cada reload → toda página refetcheaba desde cero
      // y la app se sentía muy lenta tras login.
      const userChanged =
        prevUserId !== null && prevUserId !== newUserId;
      if (userChanged) {
        queryClient.clear();
      }
      lastUserIdRef.current = newUserId;

      // Eventos que NO requieren refetch de perfil (perfil ya cargado, solo
      // se renovó el token o se revalidó la sesión).
      const skipProfileRefetch =
        initialized &&
        newUserId === prevUserId &&
        (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION");

      if (newSession?.user) {
        const uid = newSession.user.id;
        if (!skipProfileRefetch) {
          if (!initialized) setLoading(true);
          // Disparamos en paralelo el prefetch de datos de Home para que
          // cuando ProtectedRoute renderice, React Query ya tenga cache.
          prefetchPostLogin(uid);
          setTimeout(() => {
            fetchProfileAndRoles(uid).finally(() => {
              setLoading(false);
              initialized = true;
            });
          }, 0);
        } else {
          initialized = true;
        }
        if (event === "SIGNED_IN") {
          setTimeout(() => trackEvent("auth_login", { user_id: uid }), 0);
        }
      } else {
        setProfile(null);
        setRoles([]);
        setIsCoach(false);
        setLoading(false);
        initialized = true;
      }
    });

    // 2) Después getSession (fallback si no hubiera INITIAL_SESSION rápido)
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (initialized) return; // listener ya tomó el control
      setSession(existing);
      setUser(existing?.user ?? null);
      lastUserIdRef.current = existing?.user?.id ?? null;
      if (existing?.user) {
        prefetchPostLogin(existing.user.id);
        fetchProfileAndRoles(existing.user.id).finally(() => {
          setLoading(false);
          initialized = true;
        });
      } else {
        setLoading(false);
        initialized = true;
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    setIsCoach(false);
    // Limpieza explícita por si onAuthStateChange demora.
    queryClient.clear();
    lastUserIdRef.current = null;
  };

  const refreshProfile = async () => {
    if (user) await fetchProfileAndRoles(user.id);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = roles.includes("super_admin") || roles.includes("club_admin");

  return (
    <AuthContext.Provider
      value={{ user, session, profile, roles, loading, signOut, refreshProfile, hasRole, isAdmin, isCoach }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
