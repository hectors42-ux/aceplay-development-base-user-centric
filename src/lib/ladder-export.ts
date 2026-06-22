import { toPng } from "html-to-image";

/**
 * Exporta el nodo de la Escalerilla a PNG y dispara la descarga.
 */
export const exportLadderToPng = async (node: HTMLElement, filename = "piramide.png") => {
  // Asegurar fondo legible
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
  });
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
};
