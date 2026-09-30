"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGlobalContext } from "@/context/GlobalContext";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors ${
        active ? "text-gold" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

export function Header() {
  const { user, isAdmin, logout } = useGlobalContext();

  return (
    <header className="border-b border-border bg-bg-soft/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href={user ? (isAdmin ? "/admin" : "/lotteries") : "/"} className="flex items-center gap-2">
          <span className="lottery-ball h-8 w-8 bg-gold text-gold-ink text-sm">7</span>
          <span className="font-display text-xl italic tracking-tight text-ink">Lottery</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {isAdmin && <NavLink href="/admin">Panel admin</NavLink>}
          {user && !isAdmin && (
            <>
              <NavLink href="/lotteries">Loterías</NavLink>
              <NavLink href="/my-tickets">Mis boletos</NavLink>
              <NavLink href="/profile">Perfil</NavLink>
            </>
          )}

          {user ? (
            <div className="flex items-center gap-3 pl-2">
              <span className="hidden text-xs text-muted sm:inline">{user.email}</span>
              <button
                onClick={() => void logout()}
                className="rounded-full border border-border-strong px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-gold hover:text-gold"
              >
                Salir
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-gold px-4 py-1.5 text-sm font-semibold text-gold-ink transition-transform hover:scale-[1.03]"
            >
              Iniciar sesión
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
