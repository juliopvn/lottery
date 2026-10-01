import { test, expect } from "@playwright/test";
import { loginViaMagicLink } from "./helpers/auth";
import { createTestLottery, whoami } from "./helpers/testApi";
import { simulateTicketPayment } from "./helpers/stripeWebhook";

/**
 * Requiere una STRIPE_SECRET_KEY de PRUEBA real en el entorno: a diferencia
 * de draw.spec.ts / concurrency.spec.ts, aquí sí se llama al endpoint real
 * /api/stripe/checkout (que crea una Checkout Session de verdad en Stripe).
 * Solo se evita recorrer la página alojada de Stripe: en cuanto se obtiene
 * el id de la sesión, se simula el webhook `checkout.session.completed`
 * firmado, tal como indica la estrategia por defecto de la Fase 7.
 */
test("compra feliz: elige número, paga (simulado) y aparece en Mis boletos", async ({ page, baseURL }) => {
  await loginViaMagicLink(page, "e2e-user@example.com");
  const buyer = await whoami(page.request);

  const lotteryName = `Rifa Compra E2E ${Date.now()}`;
  const lotteryId = await createTestLottery(baseURL!, {
    name: lotteryName,
    closesInSeconds: 3600,
    totalNumbers: 20,
  });

  const number = 9;
  const checkoutResponse = await page.request.post("/api/stripe/checkout", {
    data: { lotteryId, number },
  });
  expect(checkoutResponse.ok()).toBe(true);
  const { url } = (await checkoutResponse.json()) as { url: string };

  const sessionIdMatch = url.match(/cs_[a-zA-Z0-9_]+/);
  expect(sessionIdMatch).not.toBeNull();
  const sessionId = sessionIdMatch![0];

  const webhookResponse = await simulateTicketPayment(baseURL!, {
    sessionId,
    lotteryId,
    userId: buyer.id,
    number,
  });
  expect(webhookResponse.ok).toBe(true);

  await page.goto(`/lotteries/${lotteryId}/success?session_id=${sessionId}`);
  await expect(page.getByText(/pago confirmado/i)).toBeVisible({ timeout: 15_000 });

  await page.goto("/my-tickets");
  // Acotado a la tarjeta de ESTA lotería: el número suelto podría coincidir
  // por substring con el timestamp del nombre de otras loterías de prueba.
  const ticketCard = page.locator(".ticket-stub", { hasText: lotteryName });
  await expect(ticketCard.getByText(String(number), { exact: true })).toBeVisible();

  await page.goto(`/lotteries/${lotteryId}`);
  await expect(page.getByRole("button", { name: String(number), exact: true })).toBeDisabled();
});
