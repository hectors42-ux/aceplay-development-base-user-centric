import { test, expect } from "../fixtures/auth";

/**
 * E2E-1 · Crear evento + categoría con herencia de preset.
 * Login qa_org → crea torneo escalerilla → categoría pádel → modalidad fija dobles.
 */
test("E2E-1 · evento escalerilla + categoría padel hereda dobles", async ({ as }) => {
  const page = await as("org");

  await page.goto("/torneos/nuevo");

  // Nombre del torneo
  await page.getByLabel(/nombre/i).first().fill(`QA Escalerilla ${Date.now()}`);
  // Preset por defecto: escalerilla. Si el wizard ofrece selector, lo elegimos.
  const presetField = page.getByLabel(/preset|formato/i).first();
  if (await presetField.count()) {
    await presetField.click().catch(() => {});
    const opt = page.getByRole("option", { name: /escalerilla/i });
    if (await opt.count()) await opt.first().click();
  }

  await page
    .getByRole("button", { name: /crear|siguiente|guardar/i })
    .first()
    .click();

  // Crear categoría: deporte = padel
  await page
    .getByRole("button", { name: /agregar categor|nueva categor/i })
    .first()
    .click();

  // Preset visible y preseleccionado
  const presetBadge = page.getByText(/escalerilla/i).first();
  await expect(presetBadge).toBeVisible();

  // Elegir pádel
  const deporteSelect = page.getByLabel(/deporte/i).first();
  await deporteSelect.click();
  await page.getByRole("option", { name: /p[áa]del/i }).first().click();

  // Modalidad debe quedar fija en dobles y deshabilitada
  const modalidad = page.getByLabel(/modalidad/i).first();
  await expect(modalidad).toBeDisabled();
  await expect(modalidad).toHaveValue(/dobles/i);

  await page
    .getByRole("button", { name: /guardar|crear categor/i })
    .first()
    .click();

  // Categoría aparece con badges
  await expect(page.getByText(/p[áa]del/i).first()).toBeVisible();
  await expect(page.getByText(/dobles/i).first()).toBeVisible();
});