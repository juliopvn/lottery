import { CreateLotteryForm } from "@/components/admin/CreateLotteryForm";

export default function NewLotteryPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl italic text-ink">Nueva lotería</h1>
      <p className="mt-2 text-sm text-muted">
        El precio y el premio se guardan en centavos; escribe el monto en pesos.
      </p>
      <div className="mt-8">
        <CreateLotteryForm />
      </div>
    </div>
  );
}
