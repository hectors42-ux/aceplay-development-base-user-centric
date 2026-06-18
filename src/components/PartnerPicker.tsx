import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MemberOption {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface PartnerPickerProps {
  value: string | null;
  onChange: (userId: string | null, member: MemberOption | null) => void;
  excludeUserId?: string | null;
}

const initialsOf = (m: MemberOption) =>
  `${m.first_name?.[0] ?? ""}${m.last_name?.[0] ?? ""}`.toUpperCase() || "·";

export const PartnerPicker = ({ value, onChange, excludeUserId }: PartnerPickerProps) => {
  const { profile, user } = useAuth();
  const tenantId = profile?.tenant_id;
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles_directory")
        .select("user_id, first_name, last_name")
        .eq("tenant_id", tenantId)
        .order("first_name");
      if (cancel) return;
      const exclude = excludeUserId ?? user?.id;
      setMembers(((data ?? []) as MemberOption[]).filter((m) => m.user_id !== exclude));
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [tenantId, excludeUserId, user?.id]);

  const selected = useMemo(
    () => members.find((m) => m.user_id === value) ?? null,
    [members, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q),
    );
  }, [members, query]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-11 w-full justify-between rounded-2xl border-border text-left font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <Users className="h-4 w-4 shrink-0 text-primary" />
            {selected ? (
              <span className="truncate text-foreground">
                {selected.first_name} {selected.last_name}
              </span>
            ) : (
              <span className="text-muted-foreground">Selecciona compañero/a</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] rounded-2xl p-0"
        align="start"
        sideOffset={8}
        collisionPadding={16}
      >
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar socio por nombre…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 rounded-xl border-border bg-background pl-8 text-sm"
            />
          </div>
          {!loading && (
            <p className="mt-1 px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {filtered.length} de {members.length} socios
            </p>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-1">
          {loading ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">Cargando socios…</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">Sin resultados</p>
          ) : (
            filtered.map((m) => {
              const active = m.user_id === value;
              return (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => {
                    onChange(m.user_id, m);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm transition-smooth hover:bg-muted",
                    active && "bg-primary/10 text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    {initialsOf(m)}
                  </span>
                  <span className="flex-1 truncate">
                    {m.first_name} {m.last_name}
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
