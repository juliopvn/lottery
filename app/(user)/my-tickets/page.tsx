import Link from "next/link";
import { ObjectId } from "mongodb";
import { getCurrentSession } from "@/lib/auth/session";
import { listTicketsByUser } from "@/lib/db/repositories/tickets";
import { findLotteryById } from "@/lib/db/repositories/lotteries";
import { serializeLottery, serializeTicket, type SerializedLottery } from "@/lib/api/serialize";
import { formatCents } from "@/lib/domain/money";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function MyTicketsPage() {
  const session = await getCurrentSession();
  if (!session) return null; // el proxy ya redirige; esto es solo una guarda de tipos.

  const tickets = await listTicketsByUser(new ObjectId(session.sub));
  const now = new Date();
  const lotteryCache = new Map<string, SerializedLottery | null>();

  const rows = await Promise.all(
    tickets.map(async (ticket) => {
      const key = ticket.lotteryId.toString();
      if (!lotteryCache.has(key)) {
        const lottery = await findLotteryById(ticket.lotteryId);
        lotteryCache.set(key, lottery ? serializeLottery(lottery, 0, now) : null);
      }
      const lottery = lotteryCache.get(key) ?? null;
      const isWinner = lottery?.status === "drawn" && lottery.winnerNumber === ticket.number;
      return { ticket: serializeTicket(ticket), lottery, isWinner };
    })
  );

  rows.sort((a, b) => (a.ticket.paidAt < b.ticket.paidAt ? 1 : -1));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl italic text-ink">Mis boletos</h1>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-border-strong p-8 text-center text-sm text-muted">
          Todavía no tienes boletos.{" "}
          <Link href="/lotteries" className="text-gold underline">
            Explora las loterías abiertas
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {rows.map(({ ticket, lottery, isWinner }) => (
            <div key={ticket.id} className="ticket-stub flex items-center gap-4 p-6">
              <span
                className={`lottery-ball h-14 w-14 flex-shrink-0 text-xl ${
                  isWinner ? "bg-gold text-gold-ink" : "bg-surface-2 text-ink"
                }`}
              >
                {ticket.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base text-ink">
                  {lottery?.name ?? "Lotería"}
                </p>
                <p className="mt-1 font-mono text-xs text-muted">
                  Pagado el {new Date(ticket.paidAt).toLocaleDateString("es-MX")}
                  {lottery ? ` · ${formatCents(lottery.ticketPriceCents)}` : ""}
                </p>
                {isWinner && <p className="mt-1 text-sm font-semibold text-gold">¡Eres el ganador!</p>}
              </div>
              {lottery && <StatusBadge status={lottery.status} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
