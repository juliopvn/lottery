import { SuccessPoller } from "@/components/lottery/SuccessPoller";

export default async function LotterySuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <SuccessPoller lotteryId={id} />
    </div>
  );
}
