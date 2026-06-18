import { test, expect } from "../fixtures/auth";

/**
 * E2E-8 · /mis-torneos muestra el torneo cerrado en E2E-7 con campeón y
 * card de reputación con métricas reales.
 */
test("E2E-8 · historial y reputación del organizador", async ({ as }) => {
  const page = await as("org");
  await page.goto("/mis-torneos");

  // Al menos un torneo finalizado visible
  await expect(page.getByText(/finalizado|cerrado/i).first()).toBeVisible();

  // Card de reputación con números
  const repCard = page.locator('[data-testid="reputacion-card"], text=/reputaci/i').first();
  await expect(repCard).toBeVisible();
  const text = await repCard.innerText();
  expect(text).toMatch(/\d+/);
});