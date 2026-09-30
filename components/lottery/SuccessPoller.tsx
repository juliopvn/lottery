"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Phase = "polling" | "found" | "timeout";

interface TicketsResponse {
  tickets: Array<{
    ticket: { number: number; paidAt: string };
    lottery: { id: string; name: string } | null;
  }>;
}

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 20; // ~40s: el webhook de Stripe puede tardar unos segundos.

export function SuccessPoller({ lotteryId }: { lotteryId: string }) {
  const [phase, setPhase] = useState<Phase>("polling");
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);

  useEffect(() => {
    let attempts = 0;
    let cancelled = false;

    async function poll() {
      attempts += 1;
      try {
        const response = await fetch("/api/tickets", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as TicketsResponse;
          const match = data.tickets.find((t) => t.lottery?.id === lotteryId);
          if (match && !cancelled) {
            setTicketNumber(match.ticket.number);
            setPhase("found");
            return;
          }
        }
      } catch {
        // Se reintenta en el siguiente ciclo.
      }

      if (cancelled) return;

      if (attempts >= MAX_ATTEMPTS) {
        setPhase("timeout");
        return;
      }

      setTimeout(() => void poll(), POLL_INTERVAL_MS);
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [lotteryId]);

  if (phase === "found") {
    return (
      <div className="ticket-stub flex flex-col items-center gap-4 px-8 py-12 text-center">
        <span className="lottery-ball winner-ball-drop h-20 w-20 bg-mint/15 text-3xl text-mint">
          {ticketNumber}
        </span>
        <h1 className="font-display text-2xl text-ink">¡Pago confirmado!</h1>
        <p className="max-w-sm text-sm text-muted">
          Tu boleto número <strong className="text-ink">{ticketNumber}</strong> ya quedó
          registrado.
        </p>
        <Link href="/my-tickets" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-gold-ink">
          Ver mis boletos
        </Link>
      </div>
    );
  }

  if (phase === "timeout") {
    return (
      <div className="ticket-stub flex flex-col items-center gap-4 px-8 py-12 text-center">
        <span className="lottery-ball h-16 w-16 bg-surface-2 text-2xl text-muted">⏳</span>
        <h1 className="font-display text-2xl text-ink">Seguimos confirmando tu pago</h1>
        <p className="max-w-sm text-sm text-muted">
          Stripe puede tardar unos segundos más en avisarnos. Tu boleto aparecerá en{" "}
          <strong className="text-ink">Mis boletos</strong> en cuanto se confirme.
        </p>
        <Link href="/my-tickets" className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-semibold text-ink">
          Ir a mis boletos
        </Link>
      </div>
    );
  }

  return (
    <div className="ticket-stub flex flex-col items-center gap-4 px-8 py-12 text-center">
      <span className="lottery-ball h-16 w-16 animate-pulse bg-surface-2 text-2xl text-gold">
        •••
      </span>
      <h1 className="font-display text-2xl text-ink">Confirmando tu pago...</h1>
      <p className="max-w-sm text-sm text-muted">
        Estamos esperando la confirmación de Stripe. Esto no debería tardar más de unos segundos.
      </p>
    </div>
  );
}
