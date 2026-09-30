import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, requireSession } from "@/lib/auth/guards";
import { handleRouteError } from "@/lib/api/handleRouteError";
import { createLotterySchema } from "@/lib/validation/lottery";
import { createLottery, lazyCloseIfPastCutoff, listLotteries } from "@/lib/db/repositories/lotteries";
import { countTicketsForLottery } from "@/lib/db/repositories/tickets";
import { serializeLottery } from "@/lib/api/serialize";

export async function GET() {
  try {
    const session = await requireSession();
    const now = new Date();
    const lotteries = await listLotteries();

    await Promise.all(
      lotteries.map((lottery) => lazyCloseIfPastCutoff(lottery._id, now))
    );

    const payload = await Promise.all(
      lotteries.map(async (lottery) => {
        const soldCount = await countTicketsForLottery(lottery._id);
        return serializeLottery(lottery, soldCount, now, {
          includeRevenue: session.role === "admin",
        });
      })
    );

    return NextResponse.json({ lotteries: payload });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const input = createLotterySchema.parse(body);

    const lottery = await createLottery(input);
    return NextResponse.json(
      { lottery: serializeLottery(lottery, 0, new Date(), { includeRevenue: true }) },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
