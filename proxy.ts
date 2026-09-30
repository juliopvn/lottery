import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * Protección de rutas. La verificación de rol aquí es una primera barrera
 * para UX (redirigir antes de renderizar); cada route handler vuelve a
 * comprobar la sesión y el rol de forma independiente, porque el proxy
 * nunca es la única línea de defensa.
 */

interface SessionPayload {
  sub: string;
  email: string;
  role: "user" | "admin";
}

async function readSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    if (payload.role !== "user" && payload.role !== "admin") return null;
    return { sub: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

const ADMIN_PAGE_PREFIX = "/admin";

const ADMIN_ONLY_API_ROUTES: Array<{ pattern: RegExp; methods: string[] }> = [
  { pattern: /^\/api\/lotteries$/, methods: ["POST"] },
  { pattern: /^\/api\/lotteries\/[^/]+\/draw$/, methods: ["POST"] },
];

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function denied(request: NextRequest, isApi: boolean, status: 401 | 403) {
  if (isApi) {
    return NextResponse.json(
      { error: status === 401 ? "No autenticado" : "No autorizado" },
      { status }
    );
  }
  if (status === 401) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.redirect(new URL("/lotteries", request.url));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = isApiRequest(pathname);
  const session = await readSession(request);

  const requiresAdmin =
    pathname.startsWith(ADMIN_PAGE_PREFIX) ||
    ADMIN_ONLY_API_ROUTES.some(
      (route) => route.pattern.test(pathname) && route.methods.includes(request.method)
    );

  if (!session) {
    return denied(request, isApi, 401);
  }

  if (requiresAdmin && session.role !== "admin") {
    return denied(request, isApi, 403);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/lotteries",
    "/lotteries/:path*",
    "/my-tickets",
    "/my-tickets/:path*",
    "/profile",
    "/profile/:path*",
    "/api/lotteries",
    "/api/lotteries/:path*",
    "/api/tickets",
    "/api/tickets/:path*",
    "/api/profile",
    "/api/profile/:path*",
  ],
};
