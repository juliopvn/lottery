import { ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db/client";
import { ensureIndexes } from "@/lib/db/indexes";
import { lotteriesCollection, ticketsCollection } from "@/lib/db/collections";
import { getStripeClient } from "@/lib/stripe/client";
import type { LotteryDoc } from "@/lib/db/types";
import { POST as webhookHandler } from "@/app/api/stripe/webhook/route";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "lottery_webhook_test";
  await ensureIndexes(await getDb());
});

afterAll(async () => {
  await mongo.stop();
});

const WEBHOOK_URL = "http://localhost:3000/api/stripe/webhook";

async function createTestLottery(overrides: Partial<LotteryDoc> = {}): Promise<LotteryDoc> {
  const lotteries = await lotteriesCollection();
  const doc: LotteryDoc = {
    _id: new ObjectId(),
    name: "Lotería de prueba",
    closesAt: new Date(Date.now() + 60 * 60_000),
    ticketPriceCents: 1000,
    prizeCents: 10_000,
    totalNumbers: 10,
    status: "open",
    winnerNumber: null,
    winnerId: null,
    drawnAt: null,
    createdAt: new Date(),
    ...overrides,
  };
  await lotteries.insertOne(doc);
  return doc;
}

function checkoutCompletedPayload(session: {
  id: string;
  lotteryId: string;
  userId: string;
  number: number;
  paymentIntentId?: string | null;
}): string {
  return JSON.stringify({
    id: "evt_test_" + session.id,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: session.id,
        object: "checkout.session",
        payment_intent: session.paymentIntentId ?? "pi_test_" + session.id,
        metadata: {
          lotteryId: session.lotteryId,
          userId: session.userId,
          number: String(session.number),
        },
      },
    },
  });
}

function signPayload(payload: string): string {
  const stripe = getStripeClient();
  return stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET as string,
  });
}

async function sendWebhook(payload: string, signature: string | null): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set("stripe-signature", signature);

  const request = new NextRequest(WEBHOOK_URL, {
    method: "POST",
    headers,
    body: payload,
  });

  return webhookHandler(request);
}

let refundSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  const stripe = getStripeClient();
  refundSpy = vi.spyOn(stripe.refunds, "create").mockResolvedValue({} as never);
});

afterEach(() => {
  refundSpy.mockRestore();
});

describe("POST /api/stripe/webhook", () => {
  it("responde 400 si la firma es inválida", async () => {
    const payload = checkoutCompletedPayload({
      id: "cs_bad_sig",
      lotteryId: new ObjectId().toString(),
      userId: new ObjectId().toString(),
      number: 1,
    });

    const response = await sendWebhook(payload, "t=1,v1=firma-invalida");
    expect(response.status).toBe(400);
    expect(refundSpy).not.toHaveBeenCalled();
  });

  it("responde 400 si falta la cabecera de firma", async () => {
    const payload = checkoutCompletedPayload({
      id: "cs_no_sig",
      lotteryId: new ObjectId().toString(),
      userId: new ObjectId().toString(),
      number: 1,
    });
    const response = await sendWebhook(payload, null);
    expect(response.status).toBe(400);
  });

  it("pago normal: inserta el boleto y responde 2xx", async () => {
    const lottery = await createTestLottery();
    const userId = new ObjectId();
    const payload = checkoutCompletedPayload({
      id: "cs_happy_path",
      lotteryId: lottery._id.toString(),
      userId: userId.toString(),
      number: 3,
    });

    const response = await sendWebhook(payload, signPayload(payload));
    expect(response.status).toBe(200);

    const tickets = await ticketsCollection();
    const ticket = await tickets.findOne({ lotteryId: lottery._id, number: 3 });
    expect(ticket).not.toBeNull();
    expect(ticket?.userId.toString()).toBe(userId.toString());
    expect(ticket?.stripeSessionId).toBe("cs_happy_path");
    expect(refundSpy).not.toHaveBeenCalled();
  });

  it("reenvío duplicado del mismo evento es un no-op idempotente", async () => {
    const lottery = await createTestLottery();
    const userId = new ObjectId();
    const payload = checkoutCompletedPayload({
      id: "cs_duplicate",
      lotteryId: lottery._id.toString(),
      userId: userId.toString(),
      number: 4,
    });
    const signature = signPayload(payload);

    const first = await sendWebhook(payload, signature);
    expect(first.status).toBe(200);
    const second = await sendWebhook(payload, signature);
    expect(second.status).toBe(200);

    const tickets = await ticketsCollection();
    const count = await tickets.countDocuments({ lotteryId: lottery._id, number: 4 });
    expect(count).toBe(1);
    expect(refundSpy).not.toHaveBeenCalled();
  });

  it("número ya vendido: la segunda sesión se reembolsa y no crea un segundo boleto", async () => {
    const lottery = await createTestLottery();
    const firstUser = new ObjectId();
    const secondUser = new ObjectId();

    const firstPayload = checkoutCompletedPayload({
      id: "cs_race_1",
      lotteryId: lottery._id.toString(),
      userId: firstUser.toString(),
      number: 5,
    });
    const firstResponse = await sendWebhook(firstPayload, signPayload(firstPayload));
    expect(firstResponse.status).toBe(200);

    const secondPayload = checkoutCompletedPayload({
      id: "cs_race_2",
      lotteryId: lottery._id.toString(),
      userId: secondUser.toString(),
      number: 5,
    });
    const secondResponse = await sendWebhook(secondPayload, signPayload(secondPayload));
    expect(secondResponse.status).toBe(200);

    expect(refundSpy).toHaveBeenCalledTimes(1);
    expect(refundSpy).toHaveBeenCalledWith({ payment_intent: "pi_test_cs_race_2" });

    const tickets = await ticketsCollection();
    const winningTicket = await tickets.findOne({ lotteryId: lottery._id, number: 5 });
    expect(winningTicket?.userId.toString()).toBe(firstUser.toString());
    const count = await tickets.countDocuments({ lotteryId: lottery._id, number: 5 });
    expect(count).toBe(1);
  });

  it("pago completado tras el cierre (closesAt pasado): se reembolsa y no se emite boleto", async () => {
    const lottery = await createTestLottery({
      closesAt: new Date(Date.now() - 60_000), // ya pasó
    });
    const payload = checkoutCompletedPayload({
      id: "cs_late_payment",
      lotteryId: lottery._id.toString(),
      userId: new ObjectId().toString(),
      number: 6,
    });

    const response = await sendWebhook(payload, signPayload(payload));
    expect(response.status).toBe(200);
    expect(refundSpy).toHaveBeenCalledTimes(1);

    const tickets = await ticketsCollection();
    const ticket = await tickets.findOne({ lotteryId: lottery._id, number: 6 });
    expect(ticket).toBeNull();
  });

  it("lotería que ya no está open (drawn/closed): se reembolsa y no se emite boleto", async () => {
    const lottery = await createTestLottery({ status: "drawn" });
    const payload = checkoutCompletedPayload({
      id: "cs_not_open",
      lotteryId: lottery._id.toString(),
      userId: new ObjectId().toString(),
      number: 7,
    });

    const response = await sendWebhook(payload, signPayload(payload));
    expect(response.status).toBe(200);
    expect(refundSpy).toHaveBeenCalledTimes(1);

    const tickets = await ticketsCollection();
    const ticket = await tickets.findOne({ lotteryId: lottery._id, number: 7 });
    expect(ticket).toBeNull();
  });

  it("ignora eventos que no son checkout.session.completed", async () => {
    const payload = JSON.stringify({
      id: "evt_ignored",
      object: "event",
      type: "payment_intent.created",
      data: { object: {} },
    });
    const response = await sendWebhook(payload, signPayload(payload));
    expect(response.status).toBe(200);
    expect(refundSpy).not.toHaveBeenCalled();
  });
});
