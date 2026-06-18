import { expect, type Page } from "@playwright/test";
import { getCredentials, type Role } from "../fixtures/users";

/**
 * Loguea una page con el rol indicado.
 * Navega a /auth, llena email+password y espera a salir de /auth.
 */
export async function loginAs(page: Page, role: Role): Promise<void> {
  const { email, password } = getCredentials(role);
  await page.goto("/auth");
  await page.getByLabel(/email|correo/i).first().fill(email);
  await page.getByLabel(/contrase|password/i).first().fill(password);
  await page
    .getByRole("button", { name: /entrar|ingresar|iniciar sesi/i })
    .first()
    .click();
  await expect(page).not.toHaveURL(/\/auth(\?|$|#)/, { timeout: 20_000 });
}