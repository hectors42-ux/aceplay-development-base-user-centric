import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type LegalDoc = Database["public"]["Tables"]["legal_documents"]["Row"];
export type LegalKind = Database["public"]["Enums"]["legal_doc_kind"];

/**
 * Trae documentos legales activos. Si existe versión del tenant, se prefiere; si no, la global.
 */
export const useLegalDocs = (kinds?: LegalKind[]) => {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      let q = supabase
        .from("legal_documents")
        .select("*")
        .eq("is_active", true)
        .order("effective_at", { ascending: false });
      if (kinds && kinds.length > 0) q = q.in("kind", kinds);
      const { data } = await q;
      if (!alive) return;
      // Para cada kind, preferir el del tenant sobre el global
      const byKind = new Map<string, LegalDoc>();
      for (const doc of (data ?? []) as LegalDoc[]) {
        const existing = byKind.get(doc.kind);
        if (!existing) {
          byKind.set(doc.kind, doc);
        } else if (existing.tenant_id === null && doc.tenant_id !== null) {
          byKind.set(doc.kind, doc);
        }
      }
      setDocs(Array.from(byKind.values()));
      setLoading(false);
    };
    void load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(kinds)]);

  return { docs, loading };
};
