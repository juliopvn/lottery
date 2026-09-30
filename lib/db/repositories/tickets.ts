import { ObjectId, MongoServerError } from "mongodb";
import { ticketsCollection } from "@/lib/db/collections";
import type { TicketDoc } from "@/lib/db/types";

export const MONGO_DUPLICATE_KEY_ERROR = 11000;

export interface InsertTicketInput {
  lotteryId: ObjectId;
  userId: ObjectId;
  number: number;
  paidAt: Date;
  stripeSessionId: string;
}

export type InsertTicketResult =
  | { outcome: "inserted"; ticket: TicketDoc }
  | { outcome: "duplicate_session" }
  | { outcome: "duplicate_number" };

/**
 * Inserta el boleto solo si Stripe confirmó el pago. La garantía real de
 * unicidad la da el índice compuesto { lotteryId, number }: si dos pagos
 * llegan casi a la vez, uno de los dos inserts falla con E11000 aquí.
 */
export async function insertTicket(input: InsertTicketInput): Promise<InsertTicketResult> {
  const tickets = await ticketsCollection();
  const doc: TicketDoc = {
    _id: new ObjectId(),
    ...input,
    createdAt: new Date(),
  };

  try {
    await tickets.insertOne(doc);
    return { outcome: "inserted", ticket: doc };
  } catch (error) {
    if (error instanceof MongoServerError && error.code === MONGO_DUPLICATE_KEY_ERROR) {
      const keyPattern = error.keyPattern ?? {};
      if ("stripeSessionId" in keyPattern) {
        return { outcome: "duplicate_session" };
      }
      if ("lotteryId" in keyPattern && "number" in keyPattern) {
        return { outcome: "duplicate_number" };
      }
    }
    throw error;
  }
}

export async function findTicketByStripeSession(stripeSessionId: string): Promise<TicketDoc | null> {
  const tickets = await ticketsCollection();
  return tickets.findOne({ stripeSessionId });
}

export async function findTicketByLotteryAndNumber(
  lotteryId: ObjectId,
  number: number
): Promise<TicketDoc | null> {
  const tickets = await ticketsCollection();
  return tickets.findOne({ lotteryId, number });
}

export async function listTicketsByLottery(lotteryId: ObjectId): Promise<TicketDoc[]> {
  const tickets = await ticketsCollection();
  return tickets.find({ lotteryId }).sort({ number: 1 }).toArray();
}

export async function listTicketsByUser(userId: ObjectId): Promise<TicketDoc[]> {
  const tickets = await ticketsCollection();
  return tickets.find({ userId }).sort({ createdAt: -1 }).toArray();
}

export async function soldNumbersForLottery(lotteryId: ObjectId): Promise<number[]> {
  const tickets = await ticketsCollection();
  const docs = await tickets.find({ lotteryId }, { projection: { number: 1 } }).toArray();
  return docs.map((doc) => doc.number);
}

export async function countTicketsForLottery(lotteryId: ObjectId): Promise<number> {
  const tickets = await ticketsCollection();
  return tickets.countDocuments({ lotteryId });
}
