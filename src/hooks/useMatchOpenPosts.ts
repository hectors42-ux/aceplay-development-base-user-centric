import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";

export interface OpenSlotRow {
  id: string;
  team: number;
  slot_index: number;
  user_id: string | null;
  joined_at: string | null;
  profile?: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
}

export interface OpenPost {
  id: string;
  user_id: string;
  format: "1set" | "best_of_3" | "best_of_5";
  available_slots: Array<{ starts_at: string }>;
  note: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  // Fase A.5 / B / C
  match_type: "singles" | "doubles";
  mode: "open_slots" | "pair_vs_pair";
  slots_total: number;
  sport: string;
  gender_filter: "any" | "male" | "female" | "mixed";
  level_min: number | null;
  level_max: number | null;
  court_id: string | null;
  partner_user_id: string | null;
  author?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
  overlap_count?: number;
  slots: OpenSlotRow[];
}

export const useMatchOpenPosts = () => {
  const { user, profile } = useAuth();
  const { sport } = useActiveSport();
  const [posts, setPosts] = useState<OpenPost[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profile?.tenant_id || !user) return;
    setLoading(true);

    const { data: avail } = await supabase
      .from("user_availability")
      .select("weekday, starts_at, ends_at")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const myAvail = (avail ?? []) as { weekday: number; starts_at: string; ends_at: string }[];

    const isInMyAvail = (iso: string) => {
      const d = new Date(iso);
      const wd = d.getDay();
      const minutes = d.getHours() * 60 + d.getMinutes();
      return myAvail.some((a) => {
        if (a.weekday !== wd) return false;
        const [sh, sm] = a.starts_at.split(":").map(Number);
        const [eh, em] = a.ends_at.split(":").map(Number);
        return minutes >= sh * 60 + sm && minutes <= eh * 60 + em;
      });
    };

    const { data } = await supabase
      .from("match_open_posts")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .eq("sport", sport)
      .eq("status", "open")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    const list = (data ?? []) as unknown as OpenPost[];
    const ids = Array.from(new Set(list.map((p) => p.user_id)));
    const authors: Record<string, OpenPost["author"]> = {};
    if (ids.length > 0) {
      const { data: prof } = await supabase
        .from("profiles_directory")
        .select("user_id, first_name, last_name, avatar_url")
        .in("user_id", ids);
      (prof ?? []).forEach((p) => {
        authors[p.user_id] = p;
      });
    }

    // Cargar slots de todos los posts
    const postIds = list.map((p) => p.id);
    let slotsByPost: Record<string, OpenSlotRow[]> = {};
    let slotProfiles: Record<string, OpenSlotRow["profile"]> = {};
    if (postIds.length > 0) {
      const { data: slots } = await supabase
        .from("match_open_post_slots")
        .select("id, post_id, team, slot_index, user_id, joined_at")
        .in("post_id", postIds)
        .order("team")
        .order("slot_index");
      const slotUserIds = Array.from(
        new Set(((slots ?? []) as Array<{ user_id: string | null }>).map((s) => s.user_id).filter(Boolean) as string[]),
      );
      if (slotUserIds.length > 0) {
        const { data: prof2 } = await supabase
          .from("profiles_directory")
          .select("user_id, first_name, last_name, avatar_url")
          .in("user_id", slotUserIds);
        (prof2 ?? []).forEach((p) => {
          slotProfiles[p.user_id] = p;
        });
      }
      ((slots ?? []) as Array<OpenSlotRow & { post_id: string }>).forEach((s) => {
        const enriched: OpenSlotRow = {
          ...s,
          profile: s.user_id ? slotProfiles[s.user_id] ?? null : null,
        };
        (slotsByPost[s.post_id] ??= []).push(enriched);
      });
    }

    const enriched = list.map((p) => {
      const slots = Array.isArray(p.available_slots) ? p.available_slots : [];
      const overlap = slots.filter((s) => s?.starts_at && isInMyAvail(s.starts_at)).length;
      return {
        ...p,
        author: authors[p.user_id] ?? null,
        overlap_count: overlap,
        slots: slotsByPost[p.id] ?? [],
      };
    });

    enriched.sort((a, b) => {
      if (a.user_id === user.id && b.user_id !== user.id) return -1;
      if (b.user_id === user.id && a.user_id !== user.id) return 1;
      return (b.overlap_count ?? 0) - (a.overlap_count ?? 0);
    });

    setPosts(enriched);
    setLoading(false);
  }, [profile, user, sport]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { posts, loading, refresh, currentUserId: user?.id };
};
