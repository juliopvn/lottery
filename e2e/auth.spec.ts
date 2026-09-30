import { test, expect } from "@playwright/test";
import { loginViaMagicLink } from "./helpers/auth";
import { waitForMagicLinkUrl } from "./helpers/mailhog";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";

test.describe("Autenticación por magic link", () => {
  test("un usuario normal puede iniciar sesión y ve el catálogo", async ({ page }) => {
    await loginViaMagicLink(page, "e2e-user@example.com");
    await expect(page).toHaveURL(/\/lotteries$/);
    await expect(page.getByRole("heading", { name: /loterías abiertas/i })).toBeVisible();
  });

  test("el admin puede iniciar sesión y ve el panel admin", async ({ page }) => {
    await loginViaMagicLink(page, ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: /panel admin/i })).toBeVisible();
  });

  test("un usuario normal no puede entrar a /admin", async ({ page }) => {
    await loginViaMagicLink(page, "e2e-user-2@example.com");
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin$/);
  });

  test("un enlace ya usado no permite entrar de nuevo", async ({ page, browser }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill("e2e-user@example.com");
    await page.getByRole("button", { name: /enviarme el enlace/i }).click();
    await page.getByText(/revisa tu correo/i).waitFor();

    const verifyUrl = await waitForMagicLinkUrl("e2e-user@example.com");

    await page.goto(verifyUrl);
    await expect(page).toHaveURL(/\/lotteries$/);

    // Reusar el mismo enlace en una sesión nueva (sin cookies) debe fallar.
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    await freshPage.goto(verifyUrl);
    await expect(freshPage).toHaveURL(/\/verify\?error=/);
    await freshContext.close();
  });
});
