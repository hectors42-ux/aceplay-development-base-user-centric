import type { Page } from "@playwright/test";

/**
 * Llena un marcador de 2/3 sets en el modal de carga de resultado.
 * Asume inputs con data-testid `score-set-<n>-local|visita`. Si la UI no
 * los expone, el test debe fallar y se agrega un follow-up para instrumentar.
 */
export async function fillScore(
  page: Page,
  sets: Array<[number, number]>,
): Promise<void> {
  for (let i = 0; i < sets.length; i++) {
    const [a, b] = sets[i];
    await page
      .locator(`[data-testid="score-set-${i + 1}-local"]`)
      .first()
      .fill(String(a));
    await page
      .locator(`[data-testid="score-set-${i + 1}-visita"]`)
      .first()
      .fill(String(b));
  }
}