import { useClubBrand } from "@/components/providers/ClubBrandProvider";

/**
 * Devuelve la etiqueta UI configurable de la escalerilla del club.
 * Default: "Escalerilla". Cada tenant puede personalizar vía `tenants.ladder_label`
 * (p.ej. "Escalera", "Top Liga", "La Cumbre", etc).
 *
 * Uso:
 *   const ladderLabel = useLadderLabel();           // "Escalerilla"
 *   const lower       = useLadderLabelLower();      // "escalerilla"
 *   const article     = useLadderLabelWithArticle(); // "la Escalerilla"
 */
export const useLadderLabel = (): string => {
  const { brand } = useClubBrand();
  return brand.ladderLabel || "Escalerilla";
};

export const useLadderLabelLower = (): string => {
  const label = useLadderLabel();
  return label.toLocaleLowerCase("es-CL");
};

/**
 * "la Escalerilla" / "la Escalera" / "el Top Liga".
 * Por defecto usa "la" (femenino, mayoría de labels). Pasa `article` para forzar.
 */
export const useLadderLabelWithArticle = (article: "la" | "el" = "la"): string => {
  const label = useLadderLabel();
  return `${article} ${label}`;
};