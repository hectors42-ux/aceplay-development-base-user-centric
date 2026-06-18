import { useState } from "react";
import { FileText, ChevronRight, Shield, BookOpen, Trophy, Building2 } from "lucide-react";
import { useLegalDocs, type LegalDoc, type LegalKind } from "@/hooks/useLegalDocs";
import { LegalDocViewer } from "./LegalDocViewer";
import { Skeleton } from "@/components/ui/skeleton";

const ICON_MAP: Record<LegalKind, typeof FileText> = {
  terms: FileText,
  privacy: Shield,
  user_manual: BookOpen,
  rating_explained: Trophy,
  club_regulation: Building2,
  other: FileText,
};

export const LegalLinksList = () => {
  const { docs, loading } = useLegalDocs();
  const [active, setActive] = useState<LegalDoc | null>(null);

  if (loading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (docs.length === 0) return null;

  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {docs.map((doc) => {
          const Icon = ICON_MAP[doc.kind];
          return (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => setActive(doc)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-smooth hover:bg-muted"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{doc.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Versión {doc.version} · {doc.tenant_id ? "Club" : "Plataforma"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>

      {active && (
        <LegalDocViewer
          open={!!active}
          onOpenChange={(o) => !o && setActive(null)}
          title={active.title}
          contentMd={active.content_md}
          version={active.version}
        />
      )}
    </>
  );
};
