import { ObjectId } from "mongodb";
import { lotteriesCollection } from "@/lib/db/collections";
import type { LotteryDoc } from "@/lib/db/types";

export interface CreateLotteryInput {
  name: string;
  closesAt: Date;
  ticketPriceCents: number;
  prizeCents: number;
  totalNumbers: number;
}

export async function createLottery(input: CreateLotteryInput): Promise<LotteryDoc> {
  const lotteries = await lotteriesCollection();
  const doc: LotteryDoc = {
    _id: new ObjectId(),
    ...input,
    status: "open",
    winnerNumber: null,
    winnerId: null,
    drawnAt: null,
    createdAt: new Date(),
  };
  await lotteries.insertOne(doc);
  return doc;
}

export async function findLotteryById(id: string | ObjectId): Promise<LotteryDoc | null> {
  const lotteries = await lotteriesCollection();
  return lotteries.findOne({ _id: new ObjectId(id) });
}

export async function listLotteries(): Promise<LotteryDoc[]> {
  const lotteries = await lotteriesCollection();
  return lotteries.find({}).sort({ createdAt: -1 }).toArray();
}

/**
 * Cierre automático derivado de la hora: si una lotería `open` ya pasó su
 * `closesAt`, la marca `closed` de forma perezosa (sin depender de un cron).
 * No hace nada si la lotería no calificaba, evitando escrituras innecesarias.
 */
export async function lazyCloseIfPastCutoff(id: ObjectId, now: Date): Promise<void> {
  const lotteries = await lotteriesCollection();
  await lotteries.updateOne(
    { _id: id, status: "open", closesAt: { $lte: now } },
    { $set: { status: "closed" } }
  );
}

export interface DrawResultInput {
  winnerNumber: number | null;
  winnerId: ObjectId | null;
  drawnAt: Date;
}

/**
 * Transición atómica a `drawn`. La condición `status: { $in: ['open', 'closed'] }`
 * en el filtro impide que dos sorteos concurrentes tengan éxito a la vez.
 */
export async function drawLotteryAtomic(
  id: ObjectId,
  result: DrawResultInput
): Promise<LotteryDoc | null> {
  const lotteries = await lotteriesCollection();
  return lotteries.findOneAndUpdate(
    { _id: id, status: { $in: ["open", "closed"] } },
    {
      $set: {
        status: "drawn",
        winnerNumber: result.winnerNumber,
        winnerId: result.winnerId,
        drawnAt: result.drawnAt,
      },
    },
    { returnDocument: "after" }
  );
}
