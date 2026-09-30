import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { BadRequestError, ConflictError, handleRouteError, NotFoundError } from "@/lib/api/handleRouteError";
import { createCheckoutSchema } from "@/lib/validation/ticket";
import { findLotteryById, lazyCloseIfPastCutoff } from "@/lib/db/repositories/lotteries";
import { findTicketByLotteryAndNumber } from "@/lib/db/repositories/tickets";
import { canBuy } from "@/lib/domain/lottery";
import { isValidTicketNumber } from "@/lib/domain/ticket";
import { createTicketCheckoutSession } from "@/lib/stripe/checkout";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const { lotteryId, number } = createCheckoutSchema.parse(body);

    const lottery = await findLotteryById(lotteryId);
    if (!lottery) throw new NotFoundError("Lotería no encontrada");

    const now = new Date();
    await lazyCloseIfPastCutoff(lottery._id, now);

    // Vuelve a leer tras el posible cierre perezoso, para no operar con datos obsoletos.
    const fresh = await findLotteryById(lotteryId);
    if (!fresh) throw new NotFoundError("Lotería no encontrada");

    if (!canBuy({ status: fresh.status, closesAt: fresh.closesAt }, now)) {
      throw new ConflictError("La venta para esta lotería ya cerró");
    }

    if (!isValidTicketNumber(number, fresh.totalNumbers)) {
      throw new BadRequestError(`El número debe estar entre 1 y ${fresh.totalNumbers}`);
    }

    // Fallo rápido: la garantía real de unicidad es el índice { lotteryId, number } en el webhook.
    const existing = await findTicketByLotteryAndNumber(fresh._id, number);
    if (existing) {
      throw new ConflictError("Ese número ya fue vendido");
    }

    const checkoutSession = await createTicketCheckoutSession({
      lotteryId: fresh._id.toString(),
      lotteryName: fresh.name,
      number,
      ticketPriceCents: fresh.ticketPriceCents,
      userId: session.sub,
      userEmail: session.email,
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe no devolvió una URL de Checkout");
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    return handleRouteError(error);
  }
}
