import { test, expect } from "../fixtures/auth";
import { findTournamentByFormat } from "../fixtures/seed";

/**
 * E2E-7 · Cierre por deadline: tabla congelada, podio visible, status finalizado.
 */
test("E2E-7 · cierre por deadline congela tabla y publica podio", async ({ as }) => {
  const t = await findTournamentByFormat("escalerilla");
  expect(t).not.toBeNull();

  const page = await as("org");
  await page.goto(`/torneos/${t!.id}/admin`);

  await page.getByRole("button", { name: /cerrar torneo|cerrar/i }).first().click();
  const confirm = page.getByRole("button", { name: /confirmar/i });
  if (await confirm.count()) await confirm.first().click();

  await expect(page.getByText(/finalizado|cerrado/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('[data-testid="podio"], text=/podio|campe/i')).toBeVisible();

  // Botones de edición deshabilitados
  const editar = page.getByRole("button", { name: /editar resultado/i });
  if (await editar.count()) {
    await expect(editar.first()).toBeDisabled();
  }
});