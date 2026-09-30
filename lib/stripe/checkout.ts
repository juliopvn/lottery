import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { getEnv } from "@/lib/env";

/** Stripe exige que una Checkout Session dure al menos 30 minutos. */
export const CHECKOUT_SESSION_MIN_LIFETIME_SECONDS = 30 * 60;

export interface CreateTicketCheckoutInput {
  lotteryId: string;
  lotteryName: string;
  number: number;
  ticketPriceCents: number;
  userId: string;
  userEmail: string;
}

export async function createTicketCheckoutSession(
  input: CreateTicketCheckoutInput
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  const { APP_URL, STRIPE_CURRENCY } = getEnv();

  const nowSeconds = Math.floor(Date.now() / 1000);

  return stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: input.userId,
    customer_email: input.userEmail,
    expires_at: nowSeconds + CHECKOUT_SESSION_MIN_LIFETIME_SECONDS,
    success_url: `${APP_URL}/lotteries/${input.lotteryId}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/lotteries/${input.lotteryId}?cancelled=1`,
    metadata: {
      lotteryId: input.lotteryId,
      userId: input.userId,
      number: String(input.number),
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: STRIPE_CURRENCY,
          unit_amount: input.ticketPriceCents,
          product_data: {
            name: `${input.lotteryName} — boleto #${input.number}`,
          },
        },
      },
    ],
  });
}
