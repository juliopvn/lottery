import type { ObjectId } from "mongodb";

export type UserRole = "user" | "admin";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  role: UserRole;
  name?: string;
  clabe?: string;
  createdAt: Date;
}

export interface MagicLinkDoc {
  _id: ObjectId;
  email: string;
  /** Hash SHA-256 del token, nunca el token en claro. */
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export type LotteryStatus = "open" | "closed" | "drawn";

export interface LotteryDoc {
  _id: ObjectId;
  name: string;
  closesAt: Date;
  ticketPriceCents: number;
  prizeCents: number;
  totalNumbers: number;
  status: LotteryStatus;
  winnerNumber?: number | null;
  winnerId?: ObjectId | null;
  drawnAt?: Date | null;
  createdAt: Date;
}

export interface TicketDoc {
  _id: ObjectId;
  lotteryId: ObjectId;
  userId: ObjectId;
  number: number;
  paidAt: Date;
  stripeSessionId: string;
  createdAt: Date;
}
