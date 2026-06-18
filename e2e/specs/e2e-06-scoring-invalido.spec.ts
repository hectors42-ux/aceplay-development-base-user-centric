import { test, expect } from "../fixtures/auth";

/**
 * E2E-6 · scoring inválido: set 3 sin súper-TB debe rechazarse.
 */
test("E2E-6 · 6-4,4-6,6-3 sin super-TB rechazado", async ({ as }) => {
  const a = await as("playerA");
  await a.goto("/desafios");

  await a
    .getByRole("button", { name: /cargar resultado|reportar/i })
    .first()
    .click();

  await a.locator('[data-testid="score-set-1-local"]').first().fill("6");
  await a.locator('[data-testid="score-set-1-visita"]').first().fill("4");
  await a.locator('[data-testid="score-set-2-local"]').first().fill("4");
  await a.locator('[data-testid="score-set-2-visita"]').first().fill("6");
  await a.locator('[data-testid="score-set-3-local"]').first().fill("6");
  await a.locator('[data-testid="score-set-3-visita"]').first().fill("3");
  await a.getByRole("button", { name: /guardar|enviar/i }).first().click();

  await expect(
    a.getByText(/super[- ]?tie|tie[- ]?break|set 3 inv/i),
  ).toBeVisible();
});