import type { Db } from "mongodb";

/**
 * Crea todos los índices obligatorios de forma idempotente. Seguro de
 * ejecutar repetidas veces (createIndex es un no-op si el índice ya existe
 * con las mismas opciones).
 */
export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true, name: "users_email_unique" }),

    db
      .collection("magic_links")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "magic_links_ttl" }),
    db.collection("magic_links").createIndex({ email: 1 }, { name: "magic_links_email" }),

    db
      .collection("tickets")
      .createIndex(
        { lotteryId: 1, number: 1 },
        { unique: true, name: "tickets_lottery_number_unique" }
      ),
    db
      .collection("tickets")
      .createIndex({ stripeSessionId: 1 }, { unique: true, name: "tickets_stripe_session_unique" }),
    db.collection("tickets").createIndex({ userId: 1 }, { name: "tickets_user" }),

    db
      .collection("lotteries")
      .createIndex({ status: 1, closesAt: 1 }, { name: "lotteries_status_closesAt" }),
  ]);
}
