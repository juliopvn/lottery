"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { pesosToCents, MIN_TICKET_PRICE_CENTS, centsToPesos } from "@/lib/domain/money";

const MIN_TICKET_PRICE_PESOS = centsToPesos(MIN_TICKET_PRICE_CENTS);

function defaultClosesAt(): string {
  const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  inThreeDays.setSeconds(0, 0);
  return inThreeDays.toISOString().slice(0, 16);
}

export function CreateLotteryForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [closesAt, setClosesAt] = useState(defaultClosesAt());
  const [ticketPricePesos, setTicketPricePesos] = useState(String(MIN_TICKET_PRICE_PESOS));
  const [prizePesos, setPrizePesos] = useState("1000");
  const [totalNumbers, setTotalNumbers] = useState("100");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        name,
        closesAt: new Date(closesAt).toISOString(),
        ticketPriceCents: pesosToCents(Number(ticketPricePesos)),
        prizeCents: pesosToCents(Number(prizePesos)),
        totalNumbers: Number(totalNumbers),
      };

      const response = await fetch("/api/lotteries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo crear la lotería.");
      }

      router.push(`/admin/lotteries/${body.lottery.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la lotería.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ticket-stub flex flex-col gap-5 px-8 py-10">
      <div>
        <label htmlFor="name" className="text-xs font-medium uppercase tracking-wide text-muted">
          Nombre
        </label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sorteo del Buen Fin"
          className="mt-1 w-full rounded-lg border border-border-strong bg-surface-2 px-4 py-3 text-sm text-ink focus:border-gold"
        />
      </div>

      <div>
        <label htmlFor="closesAt" className="text-xs font-medium uppercase tracking-wide text-muted">
          Fecha y hora del sorteo
        </label>
        <input
          id="closesAt"
          type="datetime-local"
          required
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border-strong bg-surface-2 px-4 py-3 text-sm text-ink focus:border-gold"
        />
        <p className="mt-1 text-xs text-muted-soft">La venta cierra 10 minutos antes de esta hora.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className="text-xs font-medium uppercase tracking-wide text-muted">
            Precio del boleto (MXN)
          </label>
          <input
            id="price"
            type="number"
            min={MIN_TICKET_PRICE_PESOS}
            step="0.01"
            required
            value={ticketPricePesos}
            onChange={(e) => setTicketPricePesos(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border-strong bg-surface-2 px-4 py-3 text-sm text-ink focus:border-gold"
          />
          <p className="mt-1 text-xs text-muted-soft">Mínimo ${MIN_TICKET_PRICE_PESOS} MXN.</p>
        </div>

        <div>
          <label htmlFor="prize" className="text-xs font-medium uppercase tracking-wide text-muted">
            Premio (MXN)
          </label>
          <input
            id="prize"
            type="number"
            min={0}
            step="0.01"
            required
            value={prizePesos}
            onChange={(e) => setPrizePesos(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border-strong bg-surface-2 px-4 py-3 text-sm text-ink focus:border-gold"
          />
        </div>
      </div>

      <div>
        <label htmlFor="totalNumbers" className="text-xs font-medium uppercase tracking-wide text-muted">
          Cantidad de números (1 a N)
        </label>
        <input
          id="totalNumbers"
          type="number"
          min={1}
          required
          value={totalNumbers}
          onChange={(e) => setTotalNumbers(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border-strong bg-surface-2 px-4 py-3 text-sm text-ink focus:border-gold"
        />
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 self-start rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-gold-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
      >
        {submitting ? "Creando..." : "Crear lotería"}
      </button>
    </form>
  );
}
