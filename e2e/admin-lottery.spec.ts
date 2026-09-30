import { test, expect } from "@playwright/test";
import { loginViaMagicLink } from "./helpers/auth";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";

test("el admin crea una lotería y aparece en el catálogo de usuarios", async ({ page, browser }) => {
  const uniqueName = `Rifa E2E ${Date.now()}`;

  await loginViaMagicLink(page, ADMIN_EMAIL);
  await page.goto("/admin/lotteries/new");

  await page.getByLabel("Nombre").fill(uniqueName);
  await page.getByLabel(/precio del boleto/i).fill("15");
  await page.getByLabel(/premio/i).fill("500");
  await page.getByLabel(/cantidad de números/i).fill("30");

  await page.getByRole("button", { name: /crear lotería/i }).click();
  await expect(page).toHaveURL(/\/admin\/lotteries\/[a-f0-9]{24}$/);
  await expect(page.getByRole("heading", { name: uniqueName })).toBeVisible();

  // Ahora como usuario normal, en una sesión aparte (sin la cookie de admin):
  // la lotería debe verse en el catálogo abierto.
  const userContext = await browser.newContext();
  const userPage = await userContext.newPage();
  await loginViaMagicLink(userPage, "e2e-user@example.com");
  await userPage.goto("/lotteries");
  await expect(userPage.getByText(uniqueName)).toBeVisible();
  await userContext.close();
});
