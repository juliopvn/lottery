import { ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { ensureIndexes } from "@/lib/db/indexes";
import { ticketsCollection, usersCollection } from "@/lib/db/collections";
import { insertTicket } from "@/lib/db/repositories/tickets";
import type { UserDoc } from "@/lib/db/types";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "lottery_unique_indexes_test";
  await ensureIndexes(await getDb());
});

afterAll(async () => {
  await mongo.stop();
});

describe("índice único { lotteryId, number } en tickets", () => {
  it("rechaza un número duplicado incluso con inserciones concurrentes (Promise.all)", async () => {
    const tickets = await ticketsCollection();
    const lotteryId = new ObjectId();
    const number = 7;

    const attempts = Array.from({ length: 8 }, (_, i) =>
      tickets.insertOne({
        _id: new ObjectId(),
        lotteryId,
        userId: new ObjectId(),
        number,
        paidAt: new Date(),
        stripeSessionId: `cs_concurrent_${i}`,
        createdAt: new Date(),
      })
    );

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(7);

    const stored = await tickets.find({ lotteryId, number }).toArray();
    expect(stored).toHaveLength(1);
  });

  it("insertTicket() traduce el E11000 de número duplicado a un resultado tipado", async () => {
    const lotteryId = new ObjectId();
    const first = await insertTicket({
      lotteryId,
      userId: new ObjectId(),
      number: 42,
      paidAt: new Date(),
      stripeSessionId: "cs_first",
    });
    expect(first.outcome).toBe("inserted");

    const second = await insertTicket({
      lotteryId,
      userId: new ObjectId(),
      number: 42,
      paidAt: new Date(),
      stripeSessionId: "cs_second",
    });
    expect(second.outcome).toBe("duplicate_number");
  });
});

describe("índice único stripeSessionId en tickets (idempotencia del webhook)", () => {
  it("un reenvío con el mismo stripeSessionId es un no-op detectado", async () => {
    const lotteryId = new ObjectId();
    const first = await insertTicket({
      lotteryId,
      userId: new ObjectId(),
      number: 1,
      paidAt: new Date(),
      stripeSessionId: "cs_idempotent",
    });
    expect(first.outcome).toBe("inserted");

    const resend = await insertTicket({
      lotteryId,
      userId: new ObjectId(),
      number: 2, // incluso con un número distinto, el mismo stripeSessionId no debe duplicarse
      paidAt: new Date(),
      stripeSessionId: "cs_idempotent",
    });
    expect(resend.outcome).toBe("duplicate_session");
  });
});

describe("índice único users.email", () => {
  it("rechaza un email duplicado a nivel de base de datos", async () => {
    const users = await usersCollection();
    const doc: UserDoc = {
      _id: new ObjectId(),
      email: "duplicate@example.com",
      role: "user",
      createdAt: new Date(),
    };
    await users.insertOne(doc);

    await expect(
      users.insertOne({ ...doc, _id: new ObjectId() } as UserDoc)
    ).rejects.toMatchObject({ code: 11000 });
  });
});
