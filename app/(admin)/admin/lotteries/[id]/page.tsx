import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { findLotteryById, lazyCloseIfPastCutoff } from "@/lib/db/repositories/lotteries";
import { listTicketsByLottery } from "@/lib/db/repositories/tickets";
import { findUserById } from "@/lib/db/repositories/users";
import { serializeLottery, serializeTicket } from "@/lib/api/serialize";
import { canDraw } from "@/lib/domain/lottery";
import { formatCents } from "@/lib/domain/money";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DrawButton } from "@/components/admin/DrawButton";

export const dynamic = "force-dynamic";

export default async function AdminLotteryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();

  const now = new Date();
  await lazyCloseIfPastCutoff(new ObjectId(id), now);

  const lottery = await findLotteryById(id);
  if (!lottery) notFound();

  const tickets = await listTicketsByLottery(lottery._id);
  const serialized = serializeLottery(lottery, tickets.length, now, { includeRevenue: true });
  const buyable = canDraw({ status: lottery.status, closesAt: lottery.closesAt }, now);

  const buyersById = new Map<string, string>();
  for (const ticket of tickets) {
    const key = ticket.userId.toString();
    if (!buyersById.has(key)) {
      const buyer = await findUserById(ticket.userId);
      if (buyer) buyersById.set(key, buyer.email);
    }
  }

  let winner: { email: string; name?: string; clabe: string | null } | null = null;
  if (lottery.winnerId) {
    const winnerUser = await findUserById(lottery.winnerId);
    if (winnerUser) {
      winner = { email: winnerUser.email, name: winnerUser.name, clabe: winnerUser.clabe ?? null };
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl italic text-ink">{serialized.name}</h1>
          <p className="mt-2 font-mono text-sm text-muted">
            Boleto {formatCents(serialized.ticketPriceCents)} · Premio{" "}
            <span className="text-gold">{formatCents(serialized.prizeCents)}</span> · Sorteo{" "}
            {new Date(serialized.closesAt).toLocaleString("es-MX")}
          </p>
        </div>
        <StatusBadge status={serialized.status} />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Vendidos</p>
          <p className="mt-1 font-mono text-lg text-ink">
            {serialized.soldCount}/{serialized.totalNumbers}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Recaudación</p>
          <p className="mt-1 font-mono text-lg text-ink">{formatCents(serialized.revenueCents ?? 0)}</p>
        </div>
        <div className="flex items-center justify-end rounded-xl border border-border bg-surface p-4">
          {lottery.status !== "drawn" && <DrawButton lotteryId={serialized.id} canDraw={buyable} />}
          {lottery.status === "drawn" && <span className="text-sm text-muted">Sorteo realizado</span>}
        </div>
      </div>

      {lottery.status === "drawn" && (
        <div className="mt-8 ticket-stub px-6 py-6">
          <h2 className="font-display text-lg text-ink">Resultado</h2>
          {serialized.winnerNumber === null ? (
            <p className="mt-2 text-sm text-muted">Sin boletos vendidos: sin ganador.</p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span className="lottery-ball h-14 w-14 bg-gold text-2xl text-gold-ink">
                {serialized.winnerNumber}
              </span>
              {winner ? (
                <div>
                  <p className="text-sm text-ink">{winner.name || winner.email}</p>
                  <p className="text-xs text-muted">{winner.email}</p>
                  {winner.clabe ? (
                    <p className="mt-1 font-mono text-sm text-gold">CLABE: {winner.clabe}</p>
                  ) : (
                    <p className="mt-1 text-sm text-coral">
                      El ganador no ha registrado su CLABE. No se puede transferir el premio aún.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-coral">No se encontró el registro del ganador.</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-display text-lg text-ink">Boletos vendidos</h2>
        {tickets.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aún no se ha vendido ningún boleto.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Comprador</th>
                  <th className="px-4 py-3">Pagado</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => {
                  const serializedTicket = serializeTicket(ticket);
                  return (
                    <tr key={serializedTicket.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono text-ink">{serializedTicket.number}</td>
                      <td className="px-4 py-3 text-muted">
                        {buyersById.get(ticket.userId.toString()) ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted">
                        {new Date(serializedTicket.paidAt).toLocaleString("es-MX")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
