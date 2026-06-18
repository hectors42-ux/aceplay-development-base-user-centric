import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  data_consent: Record<string, unknown> | null;
};

type AuthCtx = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  onboarded: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (user: User | null) => {
    if (!user) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url, data_consent")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setProfile(data as unknown as Profile);
      return;
    }
    // Bootstrap: crear profile mínimo si no existe.
    const email = user.email ?? "";
    const baseHandle = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "_") || `user_${user.id.slice(0, 8)}`;
    let handle = baseHandle;
    for (let i = 0; i < 5; i++) {
      const { data: taken } = await supabase.from("profiles").select("id").eq("handle", handle).maybeSingle();
      if (!taken) break;
      handle = `${baseHandle}${Math.floor(Math.random() * 9000 + 1000)}`;
    }
    const displayName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      handle;
    const { data: created } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        handle,
        display_name: displayName,
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        data_consent: {},
      })
      .select("id, handle, display_name, avatar_url, data_consent")
      .maybeSingle();
    setProfile((created as unknown as Profile) ?? null);
  };

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      // Defer Supabase calls fuera del callback.
      setTimeout(() => {
        loadProfile(s?.user ?? null).finally(() => setLoading(false));
      }, 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      loadProfile(data.session?.user ?? null).finally(() => setLoading(false));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    await loadProfile(session?.user ?? null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  const onboarded = Boolean(
    profile?.data_consent && (profile.data_consent as Record<string, unknown>)["onboarded"],
  );

  return (
    <Ctx.Provider
      value={{
        loading,
        session,
        user: session?.user ?? null,
        profile,
        onboarded,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}