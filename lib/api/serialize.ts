import type { LotteryDoc, TicketDoc, LotteryStatus } from "@/lib/db/types";
import { effectiveStatus, saleClosesAt } from "@/lib/domain/lottery";

export interface SerializedLottery {
  id: string;
  name: string;
  closesAt: string;
  saleClosesAt: string;
  ticketPriceCents: number;
  prizeCents: number;
  totalNumbers: number;
  status: LotteryStatus;
  winnerNumber: number | null;
  drawnAt: string | null;
  soldCount: number;
  revenueCents?: number;
}

export function serializeLottery(
  doc: LotteryDoc,
  soldCount: number,
  now: Date,
  options: { includeRevenue?: boolean } = {}
): SerializedLottery {
  const status = effectiveStatus({ status: doc.status, closesAt: doc.closesAt }, now);
  return {
    id: doc._id.toString(),
    name: doc.name,
    closesAt: doc.closesAt.toISOString(),
    saleClosesAt: saleClosesAt(doc.closesAt).toISOString(),
    ticketPriceCents: doc.ticketPriceCents,
    prizeCents: doc.prizeCents,
    totalNumbers: doc.totalNumbers,
    status,
    winnerNumber: doc.winnerNumber ?? null,
    drawnAt: doc.drawnAt ? doc.drawnAt.toISOString() : null,
    soldCount,
    ...(options.includeRevenue ? { revenueCents: soldCount * doc.ticketPriceCents } : {}),
  };
}

export interface SerializedTicket {
  id: string;
  lotteryId: string;
  number: number;
  paidAt: string;
}

export function serializeTicket(doc: TicketDoc): SerializedTicket {
  return {
    id: doc._id.toString(),
    lotteryId: doc.lotteryId.toString(),
    number: doc.number,
    paidAt: doc.paidAt.toISOString(),
  };
}
