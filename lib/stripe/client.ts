import Stripe from "stripe";
import { getEnv } from "@/lib/env";

let cachedClient: Stripe | undefined;

export function getStripeClient(): Stripe {
  if (!cachedClient) {
    const { STRIPE_SECRET_KEY } = getEnv();
    cachedClient = new Stripe(STRIPE_SECRET_KEY);
  }
  return cachedClient;
}
