import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { findLotteryById, lazyCloseIfPastCutoff } from "@/lib/db/repositories/lotteries";
import { countTicketsForLottery, soldNumbersForLottery } from "@/lib/db/repositories/tickets";
import { serializeLottery } from "@/lib/api/serialize";
import { canBuy as canBuyDomain } from "@/lib/domain/lottery";
import { formatCents } from "@/lib/domain/money";
import { formatDateTimeMX } from "@/lib/format/datetime";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NumberGrid } from "@/components/lottery/NumberGrid";

export const dynamic = "force-dynamic";

export default async function LotteryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { id } = await params;
  const { cancelled } = await searchParams;

  if (!ObjectId.isValid(id)) notFound();

  const now = new Date();
  await lazyCloseIfPastCutoff(new ObjectId(id), now);

  const lottery = await findLotteryById(id);
  if (!lottery) notFound();

  const [soldNumbers, soldCount] = await Promise.all([
    soldNumbersForLottery(lottery._id),
    countTicketsForLottery(lottery._id),
  ]);
  const serialized = serializeLottery(lottery, soldCount, now);
  const buyable = canBuyDomain({ status: lottery.status, closesAt: lottery.closesAt }, now);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {cancelled && (
        <p className="mb-6 rounded-lg border border-border-strong bg-surface px-4 py-3 text-sm text-muted">
          Pago cancelado. Tu número sigue disponible.
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl italic text-ink">{serialized.name}</h1>
          <p className="mt-2 font-mono text-sm text-muted">
            Boleto {formatCents(serialized.ticketPriceCents)} · Premio{" "}
            <span className="text-gold">{formatCents(serialized.prizeCents)}</span> ·{" "}
            {serialized.soldCount}/{serialized.totalNumbers} vendidos
          </p>
        </div>
        <StatusBadge status={serialized.status} />
      </div>

      <div className="mt-10">
        {serialized.status === "drawn" && (
          <div className="ticket-stub flex flex-col items-center gap-4 px-8 py-12 text-center">
            {serialized.winnerNumber !== null ? (
              <>
                <span className="text-xs uppercase tracking-[0.3em] text-muted">
                  Número ganador
                </span>
                <span className="lottery-ball winner-ball-drop h-24 w-24 bg-gold text-4xl text-gold-ink">
                  {serialized.winnerNumber}
                </span>
                <p className="max-w-sm text-sm text-muted">
                  Sorteado el {formatDateTimeMX(new Date(serialized.drawnAt ?? serialized.closesAt))}.
                  Si este es tu número, revisa{" "}
                  <a href="/my-tickets" className="text-gold underline">
                    Mis boletos
                  </a>
                  .
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">
                Esta lotería se sorteó sin boletos vendidos: no hubo ganador.
              </p>
            )}
          </div>
        )}

        {serialized.status === "closed" && (
          <div className="ticket-stub px-8 py-10 text-center">
            <p className="text-sm text-muted">
              La venta ya cerró. El sorteo se realiza a partir del{" "}
              {formatDateTimeMX(new Date(serialized.closesAt))}.
            </p>
          </div>
        )}

        {serialized.status === "open" && (
          <NumberGrid
            lotteryId={serialized.id}
            totalNumbers={serialized.totalNumbers}
            soldNumbers={soldNumbers}
            canBuy={buyable}
          />
        )}
      </div>
    </div>
  );
}
