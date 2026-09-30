import { jwtVerify, SignJWT } from "jose";
import type { UserRole } from "@/lib/db/types";

export interface SessionPayload {
  sub: string;
  email: string;
  role: UserRole;
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 días
const ALGORITHM = "HS256";

function toSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload, secret: string): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(toSecretKey(secret));
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, toSecretKey(secret), { algorithms: [ALGORITHM] });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    if (payload.role !== "user" && payload.role !== "admin") return null;
    return { sub: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_SECONDS;
