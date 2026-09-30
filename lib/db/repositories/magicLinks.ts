import { ObjectId } from "mongodb";
import { magicLinksCollection } from "@/lib/db/collections";
import type { MagicLinkDoc } from "@/lib/db/types";

export async function createMagicLink(
  email: string,
  tokenHash: string,
  expiresAt: Date
): Promise<MagicLinkDoc> {
  const links = await magicLinksCollection();
  const doc: MagicLinkDoc = {
    _id: new ObjectId(),
    email: email.toLowerCase(),
    tokenHash,
    expiresAt,
    used: false,
    createdAt: new Date(),
  };
  await links.insertOne(doc);
  return doc;
}

export async function findValidMagicLinkByHash(
  tokenHash: string,
  now: Date
): Promise<MagicLinkDoc | null> {
  const links = await magicLinksCollection();
  return links.findOne({ tokenHash, used: false, expiresAt: { $gt: now } });
}

/** Marca el enlace como usado de forma atómica; devuelve false si ya estaba usado. */
export async function consumeMagicLink(id: ObjectId): Promise<boolean> {
  const links = await magicLinksCollection();
  const result = await links.updateOne({ _id: id, used: false }, { $set: { used: true } });
  return result.modifiedCount === 1;
}
