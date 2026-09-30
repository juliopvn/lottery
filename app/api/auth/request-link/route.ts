import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { requestLinkSchema } from "@/lib/validation/auth";
import { findOrCreateUserForLogin } from "@/lib/db/repositories/users";
import { createMagicLink } from "@/lib/db/repositories/magicLinks";
import { generateMagicLinkToken } from "@/lib/auth/magicLink";
import { getEmailSender } from "@/lib/email";
import { magicLinkTemplate } from "@/lib/email/templates/magicLink";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { handleRouteError } from "@/lib/api/handleRouteError";

const GENERIC_RESPONSE = {
  message: "Si el correo es válido, te enviamos un enlace de acceso.",
};

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = requestLinkSchema.parse(body);
    const normalizedEmail = email.toLowerCase();
    const ip = clientIp(request);

    const env = getEnv();

    // En E2E, las mismas cuentas de prueba piden enlaces muchas veces en poco
    // tiempo (imposible en producción: E2E nunca puede ser true ahí, ver
    // /lib/env.ts). Sin esta salida, el rate limit haría que un request se
    // acepte sin enviar correo, y el siguiente test leería un enlace viejo.
    if (!env.E2E) {
      const emailAllowed = checkRateLimit(`email:${normalizedEmail}`, {
        windowMs: 15 * 60_000,
        maxRequests: 3,
      });
      const ipAllowed = checkRateLimit(`ip:${ip}`, { windowMs: 15 * 60_000, maxRequests: 10 });

      if (!emailAllowed || !ipAllowed) {
        // Respuesta genérica también aquí: no revelamos que hubo rate limiting.
        return NextResponse.json(GENERIC_RESPONSE);
      }
    }
    await findOrCreateUserForLogin(normalizedEmail, env.ADMIN_EMAIL);

    const { token, tokenHash } = generateMagicLinkToken();
    const expiresAt = new Date(Date.now() + env.MAGIC_LINK_TTL_MINUTES * 60_000);
    await createMagicLink(normalizedEmail, tokenHash, expiresAt);

    const verifyUrl = new URL("/api/auth/verify", env.APP_URL);
    verifyUrl.searchParams.set("token", token);

    const sender = getEmailSender();
    const { subject, html, text } = magicLinkTemplate(verifyUrl.toString());
    await sender.send({ to: normalizedEmail, subject, html, text });

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    return handleRouteError(error);
  }
}
