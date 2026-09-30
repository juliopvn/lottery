import { getCurrentSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/db/repositories/users";
import { getBankHint, maskClabe } from "@/lib/domain/clabe";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const user = await findUserById(session.sub);
  if (!user) return null;

  const initialProfile = {
    email: user.email,
    name: user.name ?? "",
    hasClabe: Boolean(user.clabe),
    clabeMasked: user.clabe ? maskClabe(user.clabe) : null,
    bankHint: user.clabe ? getBankHint(user.clabe) ?? null : null,
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl italic text-ink">Tu perfil</h1>
      <p className="mt-2 text-sm text-muted">
        Guarda tu CLABE para poder recibir el premio por SPEI si ganas una lotería.
      </p>
      <div className="mt-8">
        <ProfileForm initialProfile={initialProfile} />
      </div>
    </div>
  );
}
