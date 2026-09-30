import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession } from "@/lib/auth/guards";
import { BadRequestError, handleRouteError, NotFoundError } from "@/lib/api/handleRouteError";
import { findLotteryById, lazyCloseIfPastCutoff } from "@/lib/db/repositories/lotteries";
import {
  countTicketsForLottery,
  listTicketsByLottery,
  soldNumbersForLottery,
} from "@/lib/db/repositories/tickets";
import { findUserById } from "@/lib/db/repositories/users";
import { serializeLottery, serializeTicket } from "@/lib/api/serialize";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    if (!ObjectId.isValid(id)) throw new BadRequestError("id inválido");

    const lottery = await findLotteryById(id);
    if (!lottery) throw new NotFoundError("Lotería no encontrada");

    const now = new Date();
    await lazyCloseIfPastCutoff(lottery._id, now);

    const soldCount = await countTicketsForLottery(lottery._id);
    const isAdmin = session.role === "admin";
    const base = serializeLottery(lottery, soldCount, now, { includeRevenue: isAdmin });

    if (!isAdmin) {
      const soldNumbers = await soldNumbersForLottery(lottery._id);
      return NextResponse.json({ lottery: base, soldNumbers });
    }

    const tickets = await listTicketsByLottery(lottery._id);
    const buyersById = new Map<string, { email: string; name?: string }>();
    for (const ticket of tickets) {
      const key = ticket.userId.toString();
      if (!buyersById.has(key)) {
        const buyer = await findUserById(ticket.userId);
        if (buyer) buyersById.set(key, { email: buyer.email, name: buyer.name });
      }
    }

    const ticketsPayload = tickets.map((ticket) => ({
      ...serializeTicket(ticket),
      buyer: buyersById.get(ticket.userId.toString()) ?? null,
    }));

    // El admin necesita la CLABE completa (no enmascarada) para hacer el SPEI manual.
    let winner: { email: string; name?: string; clabe: string | null } | null = null;
    if (lottery.winnerId) {
      const winnerUser = await findUserById(lottery.winnerId);
      if (winnerUser) {
        winner = {
          email: winnerUser.email,
          name: winnerUser.name,
          clabe: winnerUser.clabe ?? null,
        };
      }
    }

    return NextResponse.json({ lottery: base, tickets: ticketsPayload, winner });
  } catch (error) {
    return handleRouteError(error);
  }
}
