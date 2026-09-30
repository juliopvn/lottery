import { ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { ensureIndexes } from "@/lib/db/indexes";
import { lotteriesCollection } from "@/lib/db/collections";
import { drawLotteryAtomic } from "@/lib/db/repositories/lotteries";
import type { LotteryDoc } from "@/lib/db/types";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "lottery_draw_test";
  await ensureIndexes(await getDb());
});

afterAll(async () => {
  await mongo.stop();
});

async function createLottery(): Promise<LotteryDoc> {
  const lotteries = await lotteriesCollection();
  const doc: LotteryDoc = {
    _id: new ObjectId(),
    name: "Lotería para sortear",
    closesAt: new Date(Date.now() - 1000),
    ticketPriceCents: 1000,
    prizeCents: 10_000,
    totalNumbers: 10,
    status: "open",
    winnerNumber: null,
    winnerId: null,
    drawnAt: null,
    createdAt: new Date(),
  };
  await lotteries.insertOne(doc);
  return doc;
}

describe("drawLotteryAtomic — sorteo atómico, sin doble sorteo", () => {
  it("solo uno de varios sorteos concurrentes tiene éxito", async () => {
    const lottery = await createLottery();
    const winnerId = new ObjectId();

    const attempts = Array.from({ length: 5 }, () =>
      drawLotteryAtomic(lottery._id, { winnerNumber: 3, winnerId, drawnAt: new Date() })
    );

    const results = await Promise.all(attempts);
    const successes = results.filter((r) => r !== null);

    expect(successes).toHaveLength(1);

    const lotteries = await lotteriesCollection();
    const final = await lotteries.findOne({ _id: lottery._id });
    expect(final?.status).toBe("drawn");
    expect(final?.winnerNumber).toBe(3);
  });

  it("no permite sortear una lotería que ya está drawn", async () => {
    const lottery = await createLottery();
    const first = await drawLotteryAtomic(lottery._id, {
      winnerNumber: 1,
      winnerId: new ObjectId(),
      drawnAt: new Date(),
    });
    expect(first).not.toBeNull();

    const second = await drawLotteryAtomic(lottery._id, {
      winnerNumber: 2,
      winnerId: new ObjectId(),
      drawnAt: new Date(),
    });
    expect(second).toBeNull();
  });
});
