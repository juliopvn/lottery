import type { Collection } from "mongodb";
import { getDb } from "@/lib/db/client";
import type { LotteryDoc, MagicLinkDoc, TicketDoc, UserDoc } from "@/lib/db/types";

export async function usersCollection(): Promise<Collection<UserDoc>> {
  const db = await getDb();
  return db.collection<UserDoc>("users");
}

export async function magicLinksCollection(): Promise<Collection<MagicLinkDoc>> {
  const db = await getDb();
  return db.collection<MagicLinkDoc>("magic_links");
}

export async function lotteriesCollection(): Promise<Collection<LotteryDoc>> {
  const db = await getDb();
  return db.collection<LotteryDoc>("lotteries");
}

export async function ticketsCollection(): Promise<Collection<TicketDoc>> {
  const db = await getDb();
  return db.collection<TicketDoc>("tickets");
}
