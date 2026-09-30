import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Los specs comparten un único buzón de MailHog y una única base Mongo (sin
  // aislamiento por worker), así que correr en paralelo produce carreras al
  // leer "el correo más reciente" para direcciones repetidas (p. ej. el admin).
  // Se prioriza que la suite sea determinista sobre que sea rápida.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    // En CI, el workflow ya corrió `next build`; aquí solo se levanta el
    // servidor de producción. En local, `next dev` compila sobre la marcha.
    command: isCI ? "npm run start" : "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      ...process.env,
      E2E: "1",
    } as Record<string, string>,
  },
});
