import Link from "next/link";
import { listLotteries, lazyCloseIfPastCutoff } from "@/lib/db/repositories/lotteries";
import { countTicketsForLottery } from "@/lib/db/repositories/tickets";
import { serializeLottery, type SerializedLottery } from "@/lib/api/serialize";
import { formatCents } from "@/lib/domain/money";
import { formatDateTimeMX } from "@/lib/format/datetime";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Countdown } from "@/components/ui/Countdown";

export const dynamic = "force-dynamic";

async function loadLotteries(): Promise<SerializedLottery[]> {
  const now = new Date();
  const lotteries = await listLotteries();
  await Promise.all(lotteries.map((lottery) => lazyCloseIfPastCutoff(lottery._id, now)));

  return Promise.all(
    lotteries.map(async (lottery) => {
      const soldCount = await countTicketsForLottery(lottery._id);
      return serializeLottery(lottery, soldCount, now);
    })
  );
}

function LotteryCard({ lottery }: { lottery: SerializedLottery }) {
  const remaining = lottery.totalNumbers - lottery.soldCount;

  return (
    <Link href={`/lotteries/${lottery.id}`} className="ticket-stub group flex flex-col gap-4 p-6 transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg text-ink">{lottery.name}</h3>
        <StatusBadge status={lottery.status} />
      </div>

      <dl className="grid grid-cols-2 gap-3 font-mono text-xs text-muted">
        <div>
          <dt className="uppercase tracking-wide">Boleto</dt>
          <dd className="mt-1 text-sm text-ink">{formatCents(lottery.ticketPriceCents)}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide">Premio</dt>
          <dd className="mt-1 text-sm text-gold">{formatCents(lottery.prizeCents)}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide">Disponibles</dt>
          <dd className="mt-1 text-sm text-ink">
            {remaining} / {lottery.totalNumbers}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide">
            {lottery.status === "open" ? "Cierra venta en" : "Sorteo"}
          </dt>
          <dd className="mt-1 text-sm text-ink">
            {lottery.status === "open" ? (
              <Countdown targetIso={lottery.saleClosesAt} />
            ) : (
              formatDateTimeMX(new Date(lottery.closesAt))
            )}
          </dd>
        </div>
      </dl>

      {lottery.status === "drawn" && (
        <p className="text-sm text-gold">
          {lottery.winnerNumber !== null
            ? `Número ganador: ${lottery.winnerNumber}`
            : "Sin boletos vendidos: sin ganador."}
        </p>
      )}
    </Link>
  );
}

export default async function LotteriesPage() {
  const lotteries = await loadLotteries();
  const open = lotteries.filter((l) => l.status === "open");
  const pending = lotteries.filter((l) => l.status === "closed");
  const drawn = lotteries.filter((l) => l.status === "drawn");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl italic text-ink">Loterías abiertas</h1>
      <p className="mt-2 text-sm text-muted">
        Elige una lotería, escoge tu número y paga con Stripe. La venta cierra 10 minutos antes
        del sorteo.
      </p>

      {open.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-border-strong p-8 text-center text-sm text-muted">
          No hay loterías abiertas en este momento. Vuelve pronto.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {open.map((lottery) => (
            <LotteryCard key={lottery.id} lottery={lottery} />
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl italic text-ink">Venta cerrada, esperando sorteo</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((lottery) => (
              <LotteryCard key={lottery.id} lottery={lottery} />
            ))}
          </div>
        </section>
      )}

      {drawn.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl italic text-ink">Resultados recientes</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {drawn.map((lottery) => (
              <LotteryCard key={lottery.id} lottery={lottery} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
