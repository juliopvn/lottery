import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession } from "@/lib/auth/guards";
import { handleRouteError } from "@/lib/api/handleRouteError";
import { listTicketsByUser } from "@/lib/db/repositories/tickets";
import { findLotteryById } from "@/lib/db/repositories/lotteries";
import { serializeLottery, serializeTicket } from "@/lib/api/serialize";

export async function GET() {
  try {
    const session = await requireSession();
    const tickets = await listTicketsByUser(new ObjectId(session.sub));

    const lotteryCache = new Map<string, Awaited<ReturnType<typeof findLotteryById>>>();
    const now = new Date();

    const payload = await Promise.all(
      tickets.map(async (ticket) => {
        const lotteryId = ticket.lotteryId.toString();
        if (!lotteryCache.has(lotteryId)) {
          lotteryCache.set(lotteryId, await findLotteryById(ticket.lotteryId));
        }
        const lottery = lotteryCache.get(lotteryId);
        return {
          ticket: serializeTicket(ticket),
          lottery: lottery ? serializeLottery(lottery, 0, now) : null,
          isWinner: Boolean(lottery?.winnerId && lottery.winnerId.equals(new ObjectId(session.sub)) && lottery.winnerNumber === ticket.number),
        };
      })
    );

    return NextResponse.json({ tickets: payload });
  } catch (error) {
    return handleRouteError(error);
  }
}
