import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { requireSession } from "@/lib/auth/guards";
import { handleRouteError, NotFoundError } from "@/lib/api/handleRouteError";
import { updateProfileSchema } from "@/lib/validation/profile";
import { findUserById, updateProfile } from "@/lib/db/repositories/users";
import { getBankHint, maskClabe } from "@/lib/domain/clabe";

function serializeProfile(user: NonNullable<Awaited<ReturnType<typeof findUserById>>>) {
  return {
    email: user.email,
    role: user.role,
    name: user.name ?? "",
    hasClabe: Boolean(user.clabe),
    clabeMasked: user.clabe ? maskClabe(user.clabe) : null,
    bankHint: user.clabe ? getBankHint(user.clabe) ?? null : null,
  };
}

export async function GET() {
  try {
    const session = await requireSession();
    const user = await findUserById(session.sub);
    if (!user) throw new NotFoundError("Usuario no encontrado");
    return NextResponse.json({ profile: serializeProfile(user) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const input = updateProfileSchema.parse(body);

    const updated = await updateProfile(new ObjectId(session.sub), input);
    if (!updated) throw new NotFoundError("Usuario no encontrado");

    return NextResponse.json({ profile: serializeProfile(updated) });
  } catch (error) {
    return handleRouteError(error);
  }
}
