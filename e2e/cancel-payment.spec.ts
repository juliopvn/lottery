import { test, expect } from "@playwright/test";
import { loginViaMagicLink } from "./helpers/auth";
import { createTestLottery } from "./helpers/testApi";

/** Requiere una STRIPE_SECRET_KEY de prueba real (crea una Checkout Session de verdad). */
test("un pago abandonado no bloquea el número: nunca llega el webhook, nunca hay boleto", async ({
  page,
  baseURL,
}) => {
  await loginViaMagicLink(page, "e2e-user@example.com");

  const lotteryId = await createTestLottery(baseURL!, {
    name: `Rifa Cancelada E2E ${Date.now()}`,
    closesInSeconds: 3600,
    totalNumbers: 20,
  });

  const number = 2;
  const checkoutResponse = await page.request.post("/api/stripe/checkout", {
    data: { lotteryId, number },
  });
  expect(checkoutResponse.ok()).toBe(true);

  // El usuario "cancela" el pago: nunca se dispara el webhook para esta sesión.
  await page.goto(`/lotteries/${lotteryId}?cancelled=1`);
  await expect(page.getByText(/pago cancelado/i)).toBeVisible();

  // El número sigue disponible: se puede volver a seleccionar y comprar.
  const numberButton = page.getByRole("button", { name: String(number), exact: true });
  await expect(numberButton).toBeEnabled();
  await numberButton.click();
  await expect(page.getByRole("button", { name: /comprar boleto/i })).toBeVisible();
});
