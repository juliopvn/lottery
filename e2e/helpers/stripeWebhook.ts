import Stripe from "stripe";

/**
 * Estrategia por defecto de la Fase 7: en vez de recorrer la página alojada
 * de Stripe, se firma un evento `checkout.session.completed` con
 * STRIPE_WEBHOOK_SECRET y se envía directamente al endpoint real del
 * webhook. No depende de la UI de Stripe ni de tarjetas de prueba.
 */

function stripeSecretForSigning(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET no está definido para firmar el evento de prueba");
  return secret;
}

export function buildCheckoutCompletedPayload(input: {
  sessionId: string;
  lotteryId: string;
  userId: string;
  number: number;
  paymentIntentId?: string;
}): string {
  return JSON.stringify({
    id: `evt_e2e_${input.sessionId}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: input.sessionId,
        object: "checkout.session",
        payment_intent: input.paymentIntentId ?? `pi_e2e_${input.sessionId}`,
        metadata: {
          lotteryId: input.lotteryId,
          userId: input.userId,
          number: String(input.number),
        },
      },
    },
  });
}

export function signPayload(payload: string): string {
  // generateTestHeaderString es una utilidad pública del SDK pensada
  // exactamente para firmar eventos de prueba sin llamar a la red de Stripe.
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: stripeSecretForSigning(),
  });
}

export async function postSignedWebhookEvent(baseUrl: string, payload: string): Promise<Response> {
  return fetch(`${baseUrl}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signPayload(payload),
    },
    body: payload,
  });
}

/** Atajo: construye y envía un evento checkout.session.completed para (lotteryId, number, userId). */
export async function simulateTicketPayment(
  baseUrl: string,
  input: { sessionId: string; lotteryId: string; userId: string; number: number }
): Promise<Response> {
  const payload = buildCheckoutCompletedPayload(input);
  return postSignedWebhookEvent(baseUrl, payload);
}
