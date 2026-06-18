import { test, expect } from "../fixtures/auth";
import { findTournamentByFormat } from "../fixtures/seed";

/**
 * E2E-4 · Organizador corrige un resultado y ve advertencia de partidos
 * dependientes antes de confirmar.
 */
test("E2E-4 · corrección de resultado dispara advertencia y recalcula tabla", async ({
  as,
}) => {
  const t = await findTournamentByFormat("escalerilla");
  expect(t).not.toBeNull();

  const page = await as("org");
  await page.goto(`/torneos/${t!.id}/admin`);

  await page
    .getByRole("button", { name: /editar resultado|corregir/i })
    .first()
    .click();

  // Advertencia de partidos dependientes
  await expect(
    page.getByText(/partidos dependientes|impacta|recalcular/i),
  ).toBeVisible();

  await page.locator('[data-testid="score-set-1-local"]').first().fill("6");
  await page.locator('[data-testid="score-set-1-visita"]').first().fill("0");
  await page.locator('[data-testid="score-set-2-local"]').first().fill("6");
  await page.locator('[data-testid="score-set-2-visita"]').first().fill("0");
  await page
    .getByRole("button", { name: /confirmar|guardar/i })
    .first()
    .click();

  await expect(page.getByText(/6-0/).first()).toBeVisible();
});