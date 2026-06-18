// PRD 11 · Mirror del catálogo de push para edge functions Deno.
// Mantener sincronizado con `src/lib/push-templates.ts`.

export type PushCategory = "juego" | "marketing" | "sistema";

interface Tpl<P> {
  kind: string;
  category: PushCategory;
  title: (p: P) => string;
  body: (p: P) => string;
  deepLink: (p: P) => string;
}

const t = <P,>(tpl: Tpl<P>) => tpl;

export const PUSH_TEMPLATES = {
  trial_ending: t<{ days: number }>({
    kind: "trial_ending",
    category: "marketing",
    title: () => "Tu trial termina pronto",
    body: (p) => `Te quedan ${p.days} días en el club. → Renová`,
    deepLink: () => `/perfil`,
  }),
};