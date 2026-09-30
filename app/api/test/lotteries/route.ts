import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { handleRouteError, NotFoundError } from "@/lib/api/handleRouteError";
import { createLottery } from "@/lib/db/repositories/lotteries";
import { MIN_TICKET_PRICE_CENTS } from "@/lib/domain/money";

/**
 * Endpoint de soporte SOLO para Playwright: permite crear una lotería con un
 * `closesAt` exacto (p. ej. "cierra en 5 minutos") sin depender de que el
 * seed y el test se ejecuten en el mismo instante. Nunca disponible salvo
 * con E2E=1, y esa variable no puede estar activa en producción (ver
 * /lib/env.ts). No está protegido por sesión: su única barrera es el flag.
 */
const schema = z.object({
  name: z.string().min(1),
  closesInSeconds: z.number().int(),
  ticketPriceCents: z.number().int().min(MIN_TICKET_PRICE_CENTS),
  prizeCents: z.number().int().min(0),
  totalNumbers: z.number().int().min(1),
});

export async function POST(request: NextRequest) {
  try {
    if (!getEnv().E2E) {
      throw new NotFoundError("No encontrado");
    }

    const body = await request.json();
    const input = schema.parse(body);
    const closesAt = new Date(Date.now() + input.closesInSeconds * 1000);

    const lottery = await createLottery({
      name: input.name,
      closesAt,
      ticketPriceCents: input.ticketPriceCents,
      prizeCents: input.prizeCents,
      totalNumbers: input.totalNumbers,
    });

    return NextResponse.json({ id: lottery._id.toString() }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
