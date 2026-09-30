import type { Page } from "@playwright/test";
import { waitForMagicLinkUrl } from "./mailhog";

/** Pide un magic link, lo busca en MailHog y navega al enlace para completar el login. */
export async function loginViaMagicLink(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByRole("button", { name: /enviarme el enlace/i }).click();
  await page.getByText(/revisa tu correo/i).waitFor();

  const verifyUrl = await waitForMagicLinkUrl(email);
  await page.goto(verifyUrl);
}
