import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { hashMagicLinkToken } from "@/lib/auth/magicLink";
import { consumeMagicLink, findValidMagicLinkByHash } from "@/lib/db/repositories/magicLinks";
import { findOrCreateUserForLogin } from "@/lib/db/repositories/users";
import { createSessionCookie } from "@/lib/auth/session";

function redirectToVerifyError(appUrl: string, reason: string) {
  const url = new URL("/verify", appUrl);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const env = getEnv();
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return redirectToVerifyError(env.APP_URL, "missing_token");
  }

  const tokenHash = hashMagicLinkToken(token);
  const magicLink = await findValidMagicLinkByHash(tokenHash, new Date());

  if (!magicLink) {
    return redirectToVerifyError(env.APP_URL, "invalid_or_expired");
  }

  const consumed = await consumeMagicLink(magicLink._id);
  if (!consumed) {
    // Ya se usó (posible reenvío o doble clic): un solo uso, sin excepciones.
    return redirectToVerifyError(env.APP_URL, "already_used");
  }

  const user = await findOrCreateUserForLogin(magicLink.email, env.ADMIN_EMAIL);
  await createSessionCookie({ sub: user._id.toString(), email: user.email, role: user.role });

  const destination = user.role === "admin" ? "/admin" : "/lotteries";
  return NextResponse.redirect(new URL(destination, env.APP_URL));
}
