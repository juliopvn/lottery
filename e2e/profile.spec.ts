import { test, expect } from "@playwright/test";
import { loginViaMagicLink } from "./helpers/auth";
import { computeClabeCheckDigit } from "../lib/domain/clabe";

function buildValidClabe(): string {
  const first17 = "0021800001183" + String(Date.now()).slice(-4);
  const check = computeClabeCheckDigit(first17);
  return `${first17}${check}`;
}

test.describe("Perfil y CLABE", () => {
  test("una CLABE válida se guarda y se muestra enmascarada", async ({ page }) => {
    await loginViaMagicLink(page, "e2e-user@example.com");
    await page.goto("/profile");

    const clabe = buildValidClabe();
    await page.getByLabel(/clabe/i).fill(clabe);
    await page.getByRole("button", { name: /guardar cambios/i }).click();

    await expect(page.getByText(/perfil actualizado/i)).toBeVisible();
    await expect(page.getByText("••••")).toBeVisible();
  });

  test("una CLABE con longitud distinta de 18 muestra error", async ({ page }) => {
    await loginViaMagicLink(page, "e2e-user-2@example.com");
    await page.goto("/profile");

    await page.getByLabel(/clabe/i).fill("12345");
    await page.getByRole("button", { name: /guardar cambios/i }).click();

    await expect(page.getByText(/clabe inválida/i)).toBeVisible();
  });

  test("una CLABE de 18 dígitos con dígito de control incorrecto muestra error", async ({ page }) => {
    await loginViaMagicLink(page, "e2e-user-2@example.com");
    await page.goto("/profile");

    const clabe = buildValidClabe();
    const wrongDigit = clabe.slice(0, 17) + String((Number(clabe[17]) + 1) % 10);

    await page.getByLabel(/clabe/i).fill(wrongDigit);
    await page.getByRole("button", { name: /guardar cambios/i }).click();

    await expect(page.getByText(/clabe inválida/i)).toBeVisible();
  });
});
