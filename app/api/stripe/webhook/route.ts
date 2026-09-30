import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import type Stripe from "stripe";
import { getEnv } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe/client";
import { findLotteryById } from "@/lib/db/repositories/lotteries";
import { findTicketByStripeSession, insertTicket } from "@/lib/db/repositories/tickets";
import { logger } from "@/lib/logging/logger";

// Body crudo obligatorio para verificar la firma de Stripe: nada de parseo automático.
export const runtime = "nodejs";

async function refundSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  reason: string,
  context: Record<string, string | number>
): Promise<void> {
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  if (!paymentIntentId) {
    logger.error("stripe_webhook_refund_missing_payment_intent", { ...context, reason });
    return;
  }

  try {
    await stripe.refunds.create({ payment_intent: paymentIntentId });
    logger.warn("stripe_webhook_refunded", { ...context, reason });
  } catch (error) {
    logger.error("stripe_webhook_refund_failed", {
      ...context,
      reason,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(request: NextRequest) {
  const env = getEnv();
  const stripe = getStripeClient();

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Falta la firma de Stripe" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    logger.warn("stripe_webhook_invalid_signature", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const stripeSessionId = session.id;

  // Idempotencia: un reenvío de Stripe para una sesión ya procesada es un no-op.
  const existingTicket = await findTicketByStripeSession(stripeSessionId);
  if (existingTicket) {
    logger.info("stripe_webhook_duplicate_noop", { stripeSessionId });
    return NextResponse.json({ received: true });
  }

  const lotteryId = session.metadata?.lotteryId;
  const userId = session.metadata?.userId;
  const numberRaw = session.metadata?.number;

  if (
    !lotteryId ||
    !userId ||
    !numberRaw ||
    !ObjectId.isValid(lotteryId) ||
    !ObjectId.isValid(userId) ||
    !Number.isInteger(Number(numberRaw))
  ) {
    logger.error("stripe_webhook_missing_metadata", { stripeSessionId });
    return NextResponse.json({ received: true });
  }

  const number = Number(numberRaw);
  const lottery = await findLotteryById(lotteryId);
  const now = new Date();

  // Pago completado tarde o lotería ya no vigente: se reembolsa, no se emite boleto.
  if (!lottery || lottery.status !== "open" || now.getTime() >= lottery.closesAt.getTime()) {
    const reason = !lottery
      ? "lottery_not_found"
      : lottery.status !== "open"
        ? "lottery_not_open"
        : "past_closes_at";
    await refundSession(stripe, session, reason, { stripeSessionId, lotteryId, number });
    return NextResponse.json({ received: true });
  }

  const result = await insertTicket({
    lotteryId: lottery._id,
    userId: new ObjectId(userId),
    number,
    paidAt: now,
    stripeSessionId,
  });

  if (result.outcome === "duplicate_session") {
    logger.info("stripe_webhook_duplicate_noop", { stripeSessionId });
    return NextResponse.json({ received: true });
  }

  if (result.outcome === "duplicate_number") {
    // Carrera de pago: dos usuarios pagaron el mismo número casi a la vez.
    // El índice único { lotteryId, number } rechazó el segundo insert.
    await refundSession(stripe, session, "number_already_sold", {
      stripeSessionId,
      lotteryId,
      number,
    });
    return NextResponse.json({ received: true });
  }

  logger.info("ticket_sold", { lotteryId, number, stripeSessionId });
  return NextResponse.json({ received: true });
}
