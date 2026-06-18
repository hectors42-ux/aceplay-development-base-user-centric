import { test, expect } from "../fixtures/auth";
import { findTournamentByFormat } from "../fixtures/seed";

/**
 * E2E-2 · qa_org2 NO puede ver/abrir la consola del torneo de qa_org.
 */
test("E2E-2 · organizador ajeno no puede abrir consola", async ({ as }) => {
  const t = await findTournamentByFormat("escalerilla");
  expect(t, "debe existir un torneo escalerilla sembrado").not.toBeNull();

  const page = await as("org2");

  // No aparece en "mis torneos"
  await page.goto("/mis-torneos");
  await expect(page.getByText(t!.name)).toHaveCount(0);

  // Acceso directo a la consola: redirige o muestra denegado.
  await page.goto(`/torneos/${t!.id}/admin`);
  const denegado = page.getByText(
    /acceso denegado|no autorizad|sin permiso|404|no encontrado/i,
  );
  const redirected = !page.url().includes(`/torneos/${t!.id}/admin`);
  expect(redirected || (await denegado.count()) > 0).toBeTruthy();
});