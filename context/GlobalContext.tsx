"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/db/types";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  hasClabe: boolean;
}

interface GlobalContextValue {
  user: SessionUser | null;
  isAdmin: boolean;
  setUser: (user: SessionUser | null) => void;
  logout: () => Promise<void>;
}

const GlobalContext = createContext<GlobalContextValue | undefined>(undefined);

export function GlobalProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const router = useRouter();

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  }, [router]);

  const value = useMemo<GlobalContextValue>(
    () => ({ user, isAdmin: user?.role === "admin", setUser, logout }),
    [user, logout]
  );

  return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
}

export function useGlobalContext(): GlobalContextValue {
  const ctx = useContext(GlobalContext);
  if (!ctx) {
    throw new Error("useGlobalContext debe usarse dentro de <GlobalProvider>");
  }
  return ctx;
}
