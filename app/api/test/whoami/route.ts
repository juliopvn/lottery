import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getCurrentSession } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/auth/guards";
import { handleRouteError, NotFoundError } from "@/lib/api/handleRouteError";

/**
 * Endpoint de soporte SOLO para Playwright: expone el id de sesión actual
 * para poder construir metadata (lotteryId, userId, number) de un evento de
 * webhook simulado sin tener que decodificar la cookie de sesión a mano.
 * Nunca disponible salvo con E2E=1.
 */
export async function GET() {
  try {
    if (!getEnv().E2E) throw new NotFoundError("No encontrado");

    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    return NextResponse.json({ id: session.sub, email: session.email, role: session.role });
  } catch (error) {
    return handleRouteError(error);
  }
}
