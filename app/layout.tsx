import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { GlobalProvider, type SessionUser } from "@/context/GlobalContext";
import { getCurrentSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/db/repositories/users";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Lottery",
  description: "Loterías con boletos numerados, pago con Stripe y sorteo transparente.",
};

async function loadSessionUser(): Promise<SessionUser | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const user = await findUserById(session.sub);
  if (!user) return null;

  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
    hasClabe: Boolean(user.clabe),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const initialUser = await loadSessionUser();

  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <GlobalProvider initialUser={initialUser}>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </GlobalProvider>
      </body>
    </html>
  );
}
