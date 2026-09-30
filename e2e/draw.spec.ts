import { test, expect } from "@playwright/test";
import { loginViaMagicLink } from "./helpers/auth";
import { createTestLottery, whoami } from "./helpers/testApi";
import { simulateTicketPayment } from "./helpers/stripeWebhook";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";

/**
 * Estos escenarios prueban el sorteo, no la creación de la Checkout Session,
 * así que insertan el boleto directamente vía un webhook firmado (sin pasar
 * por /api/stripe/checkout): así no dependen de tener una STRIPE_SECRET_KEY
 * real configurada, a diferencia de purchase.spec.ts.
 */

test("el admin ejecuta el sorteo, el ganador lo ve en sus boletos, y no se puede sortear dos veces", async ({
  page,
  browser,
  baseURL,
}) => {
  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  await loginViaMagicLink(buyerPage, "e2e-user@example.com");
  const buyer = await whoami(buyerPage.request);

  const lotteryId = await createTestLottery(baseURL!, {
    name: `Rifa Sorteo E2E ${Date.now()}`,
    closesInSeconds: 3,
    totalNumbers: 5,
  });

  const paymentResponse = await simulateTicketPayment(baseURL!, {
    sessionId: `cs_e2e_draw_${Date.now()}`,
    lotteryId,
    userId: buyer.id,
    number: 1,
  });
  expect(paymentResponse.ok).toBe(true);

  // Espera a que pase closesAt (el sorteo solo se permite después).
  await buyerPage.waitForTimeout(3500);

  await loginViaMagicLink(page, ADMIN_EMAIL);
  await page.goto(`/admin/lotteries/${lotteryId}`);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: /ejecutar sorteo/i }).click();

  await expect(page.getByText(/resultado/i)).toBeVisible();
  await expect(page.getByText(buyer.email).first()).toBeVisible();

  // No debe poder sortearse de nuevo: el botón desaparece / no está disponible.
  await expect(page.getByRole("button", { name: /ejecutar sorteo/i })).toHaveCount(0);

  // El ganador ve el resultado en "Mis boletos".
  await buyerPage.goto("/my-tickets");
  await expect(buyerPage.getByText(/eres el ganador/i)).toBeVisible();

  await buyerContext.close();
});

test("un sorteo sin boletos vendidos no falla y se muestra sin ganador", async ({ page, baseURL }) => {
  const lotteryId = await createTestLottery(baseURL!, {
    name: `Rifa Sin Ventas E2E ${Date.now()}`,
    closesInSeconds: 2,
    totalNumbers: 5,
  });

  await page.waitForTimeout(2500);

  await loginViaMagicLink(page, ADMIN_EMAIL);
  await page.goto(`/admin/lotteries/${lotteryId}`);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: /ejecutar sorteo/i }).click();

  await expect(page.getByText(/sin boletos vendidos: sin ganador/i)).toBeVisible();
});
