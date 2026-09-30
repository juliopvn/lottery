import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { randomInt } from "node:crypto";
import { requireAdmin } from "@/lib/auth/guards";
import { BadRequestError, ConflictError, handleRouteError, NotFoundError } from "@/lib/api/handleRouteError";
import { drawLotteryAtomic, findLotteryById } from "@/lib/db/repositories/lotteries";
import { findTicketByLotteryAndNumber, soldNumbersForLottery } from "@/lib/db/repositories/tickets";
import { canDraw } from "@/lib/domain/lottery";
import { pickWinner } from "@/lib/domain/winner";
import { serializeLottery } from "@/lib/api/serialize";
import { logger } from "@/lib/logging/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!ObjectId.isValid(id)) throw new BadRequestError("id inválido");

    const lottery = await findLotteryById(id);
    if (!lottery) throw new NotFoundError("Lotería no encontrada");

    const now = new Date();
    if (!canDraw({ status: lottery.status, closesAt: lottery.closesAt }, now)) {
      if (lottery.status === "drawn") {
        throw new ConflictError("Esta lotería ya fue sorteada");
      }
      throw new ConflictError("Aún no se puede sortear: la venta no ha cerrado");
    }

    const soldNumbers = await soldNumbersForLottery(lottery._id);
    const winnerNumber = pickWinner(soldNumbers, (max) => randomInt(max));

    let winnerId: ObjectId | null = null;
    if (winnerNumber !== null) {
      const winningTicket = await findTicketByLotteryAndNumber(lottery._id, winnerNumber);
      winnerId = winningTicket?.userId ?? null;
    }

    const drawnAt = new Date();
    const updated = await drawLotteryAtomic(lottery._id, { winnerNumber, winnerId, drawnAt });

    if (!updated) {
      // Perdió la carrera contra otro sorteo concurrente: no es un error del cliente,
      // pero tampoco debe repetirse el sorteo.
      throw new ConflictError("Esta lotería ya fue sorteada");
    }

    logger.info("lottery_drawn", {
      lotteryId: lottery._id.toString(),
      winnerNumber: winnerNumber ?? undefined,
      soldCount: soldNumbers.length,
      hadWinner: winnerNumber !== null,
    });

    return NextResponse.json({
      lottery: serializeLottery(updated, soldNumbers.length, drawnAt, { includeRevenue: true }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
