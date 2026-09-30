import type { LotteryStatus } from "@/lib/db/types";

const LABELS: Record<LotteryStatus, string> = {
  open: "Abierta",
  closed: "Venta cerrada",
  drawn: "Sorteada",
};

const STYLES: Record<LotteryStatus, string> = {
  open: "bg-mint/15 text-mint border-mint/30",
  closed: "bg-coral/15 text-coral border-coral/30",
  drawn: "bg-gold/15 text-gold border-gold/30",
};

export function StatusBadge({ status }: { status: LotteryStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
