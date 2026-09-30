import Link from "next/link";
import { lazyCloseIfPastCutoff, listLotteries } from "@/lib/db/repositories/lotteries";
import { countTicketsForLottery } from "@/lib/db/repositories/tickets";
import { serializeLottery } from "@/lib/api/serialize";
import { formatCents } from "@/lib/domain/money";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const now = new Date();
  const lotteries = await listLotteries();
  await Promise.all(lotteries.map((lottery) => lazyCloseIfPastCutoff(lottery._id, now)));

  const rows = await Promise.all(
    lotteries.map(async (lottery) => {
      const soldCount = await countTicketsForLottery(lottery._id);
      return serializeLottery(lottery, soldCount, now, { includeRevenue: true });
    })
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl italic text-ink">Panel admin</h1>
          <p className="mt-2 text-sm text-muted">Crea loterías y ejecuta sorteos.</p>
        </div>
        <Link
          href="/admin/lotteries/new"
          className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-gold-ink transition-transform hover:scale-[1.02]"
        >
          + Nueva lotería
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-border-strong p-8 text-center text-sm text-muted">
          Aún no hay loterías. Crea la primera.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Lotería</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Vendidos</th>
                <th className="px-4 py-3">Recaudación</th>
                <th className="px-4 py-3">Premio</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((lottery) => (
                <tr key={lottery.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-ink">{lottery.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lottery.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">
                    {lottery.soldCount}/{lottery.totalNumbers}
                  </td>
                  <td className="px-4 py-3 font-mono text-ink">
                    {formatCents(lottery.revenueCents ?? 0)}
                  </td>
                  <td className="px-4 py-3 font-mono text-gold">{formatCents(lottery.prizeCents)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/lotteries/${lottery.id}`} className="text-sm text-gold underline">
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
