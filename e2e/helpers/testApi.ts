import type { APIRequestContext } from "@playwright/test";

export interface CreateTestLotteryInput {
  name: string;
  closesInSeconds: number;
  ticketPriceCents?: number;
  prizeCents?: number;
  totalNumbers?: number;
}

/** Crea una lotería con un `closesAt` exacto vía el endpoint de soporte (solo E2E=1). */
export async function createTestLottery(
  baseUrl: string,
  input: CreateTestLotteryInput
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/test/lotteries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ticketPriceCents: 1000,
      prizeCents: 10_000,
      totalNumbers: 20,
      ...input,
    }),
  });

  if (!response.ok) {
    throw new Error(`No se pudo crear la lotería de prueba: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { id: string };
  return body.id;
}

/** Usa el jar de cookies del navegador (sesión logueada) para saber el id del usuario actual. */
export async function whoami(request: APIRequestContext): Promise<{ id: string; email: string; role: string }> {
  const response = await request.get("/api/test/whoami");
  if (!response.ok()) {
    throw new Error(`/api/test/whoami falló: ${response.status()}`);
  }
  return response.json();
}
