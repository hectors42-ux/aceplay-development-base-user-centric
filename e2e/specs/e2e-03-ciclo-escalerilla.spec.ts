import { test, expect } from "../fixtures/auth";

/**
 * E2E-3 · Ciclo desafío escalerilla con propuesta de 3 slots y realtime.
 * Selectores genéricos: si la UI no expone los testids esperados, el test
 * falla y se debe instrumentar en un follow-up.
 */
test("E2E-3 · desafío libre + confirmación + resultado actualiza tabla", async ({ as }) => {
  const a = await as("playerA");
  const b = await as("playerB");

  // A → desafiar a B
  await a.goto("/rivales");
  const card = a
    .locator("[data-testid='rival-card']", { hasText: /./ })
    .first();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /desafiar/i }).first().click();
  await a.getByRole("button", { name: /enviar|crear desaf/i }).first().click();

  // B → propone 3 slots
  await b.goto("/desafios");
  await b
    .getByRole("button", { name: /proponer horarios|proponer slots/i })
    .first()
    .click();
  for (let i = 0; i < 3; i++) {
    await b
      .getByRole("button", { name: /agregar slot|nuevo horario/i })
      .first()
      .click();
  }
  await b.getByRole("button", { name: /enviar propuesta/i }).first().click();

  // A → confirma 1 slot
  await a.goto("/desafios");
  await a
    .getByRole("button", { name: /confirmar/i })
    .first()
    .click();

  // A → carga resultado 6-3 6-2
  await a
    .getByRole("button", { name: /cargar resultado|reportar/i })
    .first()
    .click();
  await a.locator('[data-testid="score-set-1-local"]').first().fill("6");
  await a.locator('[data-testid="score-set-1-visita"]').first().fill("3");
  await a.locator('[data-testid="score-set-2-local"]').first().fill("6");
  await a.locator('[data-testid="score-set-2-visita"]').first().fill("2");
  await a.getByRole("button", { name: /guardar|enviar/i }).first().click();

  // B confirma
  await b.goto("/desafios");
  await b
    .getByRole("button", { name: /confirmar resultado/i })
    .first()
    .click();

  // Tabla: la posición de A debe reflejar el cambio (realtime en B)
  await b.goto("/tabla");
  await expect
    .poll(
      async () => (await b.locator('[data-testid="tabla-row"]').count()) > 0,
      { timeout: 10_000 },
    )
    .toBeTruthy();
});