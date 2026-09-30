import { test, expect } from "@playwright/test";
import { loginViaMagicLink } from "./helpers/auth";
import { createTestLottery, whoami } from "./helpers/testApi";
import { simulateTicketPayment } from "./helpers/stripeWebhook";

/**
 * La garantía real de "un número, un dueño" es el índice único
 * { lotteryId, number } en MongoDB (ver tests/integration/db/uniqueIndexes.test.ts
 * y tests/integration/stripe/webhook.test.ts para la cobertura a nivel de
 * unidad/integración). Este E2E confirma el comportamiento observable desde
 * afuera: dos "pagos" casi simultáneos para el mismo número solo dejan un
 * boleto, sin necesidad de una STRIPE_SECRET_KEY real (el webhook se simula).
 */
test("dos pagos casi simultáneos para el mismo número solo generan un boleto", async ({
  browser,
  baseURL,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await loginViaMagicLink(pageA, "e2e-user@example.com");
  await loginViaMagicLink(pageB, "e2e-user-2@example.com");

  const userA = await whoami(pageA.request);
  const userB = await whoami(pageB.request);

  const lotteryId = await createTestLottery(baseURL!, {
    name: `Rifa Concurrencia E2E ${Date.now()}`,
    closesInSeconds: 600,
    totalNumbers: 10,
  });

  const number = 4;
  const [responseA, responseB] = await Promise.all([
    simulateTicketPayment(baseURL!, {
      sessionId: `cs_e2e_conc_a_${Date.now()}`,
      lotteryId,
      userId: userA.id,
      number,
    }),
    simulateTicketPayment(baseURL!, {
      sessionId: `cs_e2e_conc_b_${Date.now()}`,
      lotteryId,
      userId: userB.id,
      number,
    }),
  ]);

  expect(responseA.ok).toBe(true);
  expect(responseB.ok).toBe(true);

  await pageA.goto("/my-tickets");
  await pageB.goto("/my-tickets");

  const aHasTicket = await pageA.getByText(`Rifa Concurrencia E2E`, { exact: false }).count();
  const bHasTicket = await pageB.getByText(`Rifa Concurrencia E2E`, { exact: false }).count();

  // Exactamente uno de los dos usuarios terminó con el boleto; el otro fue "reembolsado".
  expect(aHasTicket + bHasTicket).toBe(1);

  // El número queda marcado como vendido para cualquiera que lo consulte después.
  await pageA.goto(`/lotteries/${lotteryId}`);
  await expect(pageA.getByRole("button", { name: String(number), exact: true })).toBeDisabled();

  await contextA.close();
  await contextB.close();
});
