import { getCurrentSession } from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/jwt";

export class UnauthorizedError extends Error {
  constructor(message = "No autenticado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "No autorizado") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Cada route handler vuelve a comprobar la sesión de forma independiente:
 * el proxy es una primera barrera de UX, nunca la única línea de defensa.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getCurrentSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "admin") throw new ForbiddenError();
  return session;
}
