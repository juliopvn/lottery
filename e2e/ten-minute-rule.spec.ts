import { test, expect } from "@playwright/test";
import { loginViaMagicLink } from "./helpers/auth";
import { createTestLottery } from "./helpers/testApi";

test("la venta se bloquea en la UI y en la API dentro de los 10 minutos previos al cierre", async ({
  page,
  baseURL,
}) => {
  const lotteryId = await createTestLottery(baseURL!, {
    name: `Rifa Relámpago E2E ${Date.now()}`,
    closesInSeconds: 5 * 60, // cierra en 5 minutos: dentro de la ventana bloqueada de 10 min
  });

  await loginViaMagicLink(page, "e2e-user@example.com");
  await page.goto(`/lotteries/${lotteryId}`);

  await expect(page.getByText(/la venta para esta lotería ya está cerrada/i)).toBeVisible();

  const firstNumberButton = page.getByRole("button", { name: "1", exact: true });
  await expect(firstNumberButton).toBeDisabled();

  const response = await page.request.post("/api/stripe/checkout", {
    data: { lotteryId, number: 1 },
  });
  expect(response.status()).toBe(409);
});
