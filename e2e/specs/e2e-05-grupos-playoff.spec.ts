import { test, expect } from "../fixtures/auth";
import { findTournamentByFormat } from "../fixtures/seed";

/**
 * E2E-5 · Avanzar de grupos a playoff (americano de parejas).
 */
test("E2E-5 · grupos completos avanzan a playoff de 8", async ({ as }) => {
  const t = await findTournamentByFormat("grupos_playoff");
  expect(t, "debe existir torneo grupos_playoff sembrado").not.toBeNull();

  const page = await as("org");
  await page.goto(`/torneos/${t!.id}/admin`);

  const btn = page.getByRole("button", { name: /avanzar a playoff/i }).first();
  await expect(btn).toBeEnabled();
  await btn.click();

  // Confirmación si aparece
  const confirm = page.getByRole("button", { name: /confirmar/i });
  if (await confirm.count()) await confirm.first().click();

  await expect(
    page.locator('[data-testid="bracket-round-qf"], text=/cuartos/i'),
  ).toBeVisible({ timeout: 15_000 });
});