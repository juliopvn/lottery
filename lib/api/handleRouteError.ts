import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/guards";

export class BadRequestError extends Error {}
export class NotFoundError extends Error {}
export class ConflictError extends Error {}

/** Convierte un error lanzado en un route handler a una respuesta HTTP consistente. */
export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof BadRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ZodError) {
    // El mensaje del primer issue (p. ej. el `message` de un .refine()) es más
    // útil para el usuario que un "Datos inválidos" genérico.
    const firstMessage = error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: firstMessage, details: error.issues }, { status: 400 });
  }

  console.error("[api] error inesperado:", error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
