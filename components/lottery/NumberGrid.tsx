"use client";

import { useMemo, useState } from "react";

export function NumberGrid({
  lotteryId,
  totalNumbers,
  soldNumbers,
  canBuy,
}: {
  lotteryId: string;
  totalNumbers: number;
  soldNumbers: number[];
  canBuy: boolean;
}) {
  const sold = useMemo(() => new Set(soldNumbers), [soldNumbers]);
  const numbers = useMemo(() => Array.from({ length: totalNumbers }, (_, i) => i + 1), [totalNumbers]);

  const [selected, setSelected] = useState<number | null>(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    if (selected === null) return;
    setBuying(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotteryId, number: selected }),
      });

      const body = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!response.ok || !body?.url) {
        throw new Error(body?.error ?? "No se pudo iniciar el pago. Intenta de nuevo.");
      }

      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el pago.");
      setBuying(false);
    }
  }

  return (
    <div>
      {!canBuy && (
        <p className="mb-4 rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
          La venta para esta lotería ya está cerrada.
        </p>
      )}

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(2.75rem, 1fr))" }}
      >
        {numbers.map((n) => {
          const isSold = sold.has(n);
          const isSelected = selected === n;
          return (
            <button
              key={n}
              type="button"
              disabled={isSold || !canBuy}
              onClick={() => setSelected(n)}
              aria-pressed={isSelected}
              className={`lottery-ball aspect-square w-full border text-sm ${
                isSold
                  ? "cursor-not-allowed border-transparent bg-surface-2/50 text-muted-soft/50 line-through"
                  : isSelected
                    ? "scale-110 border-gold bg-gold text-gold-ink"
                    : "border-border-strong bg-surface-2 text-ink hover:border-gold hover:text-gold"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div className="ticket-stub sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <p className="text-sm text-ink">
            Número <span className="font-mono text-gold">{selected}</span> seleccionado
          </p>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-coral">{error}</span>}
            <button
              type="button"
              onClick={() => void handleBuy()}
              disabled={buying}
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-gold-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {buying ? "Redirigiendo a Stripe..." : "Comprar boleto"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
