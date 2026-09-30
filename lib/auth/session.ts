import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { SESSION_COOKIE_MAX_AGE_SECONDS, signSessionToken, verifySessionToken, type SessionPayload } from "@/lib/auth/jwt";

export const SESSION_COOKIE_NAME = "lottery_session";

export async function createSessionCookie(payload: SessionPayload): Promise<void> {
  const { JWT_SECRET, NODE_ENV } = getEnv();
  const token = await signSessionToken(payload, JWT_SECRET);
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
}

/** Solo usable en Server Components / Route Handlers (runtime Node o Edge, no en proxy.ts). */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const { JWT_SECRET } = getEnv();
  return verifySessionToken(token, JWT_SECRET);
}
