"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DrawButton({ lotteryId, canDraw }: { lotteryId: string; canDraw: boolean }) {
  const router = useRouter();
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDraw() {
    if (!confirm("¿Ejecutar el sorteo ahora? Esta acción no se puede deshacer.")) return;

    setDrawing(true);
    setError(null);

    try {
      const response = await fetch(`/api/lotteries/${lotteryId}/draw`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo ejecutar el sorteo.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ejecutar el sorteo.");
    } finally {
      setDrawing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => void handleDraw()}
        disabled={!canDraw || drawing}
        className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-gold-ink transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {drawing ? "Sorteando..." : "Ejecutar sorteo"}
      </button>
      {error && <span className="text-xs text-coral">{error}</span>}
    </div>
  );
}
