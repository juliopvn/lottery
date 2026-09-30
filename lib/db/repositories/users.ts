import { ObjectId } from "mongodb";
import { usersCollection } from "@/lib/db/collections";
import type { UserDoc, UserRole } from "@/lib/db/types";

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  const users = await usersCollection();
  return users.findOne({ email: email.toLowerCase() });
}

export async function findUserById(id: string | ObjectId): Promise<UserDoc | null> {
  const users = await usersCollection();
  return users.findOne({ _id: new ObjectId(id) });
}

export async function createUser(email: string, role: UserRole = "user"): Promise<UserDoc> {
  const users = await usersCollection();
  const doc: UserDoc = {
    _id: new ObjectId(),
    email: email.toLowerCase(),
    role,
    createdAt: new Date(),
  };
  await users.insertOne(doc);
  return doc;
}

/**
 * Devuelve el usuario para ese email, creándolo si no existe.
 * Si el email coincide con ADMIN_EMAIL, garantiza role: 'admin' (bootstrap
 * del admin sin seed: basta con iniciar sesión).
 */
export async function findOrCreateUserForLogin(
  email: string,
  adminEmail: string
): Promise<UserDoc> {
  const users = await usersCollection();
  const normalized = email.toLowerCase();
  const isAdmin = normalized === adminEmail.toLowerCase();

  const result = await users.findOneAndUpdate(
    { email: normalized },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        email: normalized,
        createdAt: new Date(),
      },
      ...(isAdmin ? { $set: { role: "admin" as const } } : { $setOnInsert: { role: "user" as const } }),
    },
    { upsert: true, returnDocument: "after" }
  );

  if (!result) {
    throw new Error("No se pudo crear u obtener el usuario");
  }
  return result;
}

export async function updateProfile(
  userId: string | ObjectId,
  data: { name?: string; clabe?: string }
): Promise<UserDoc | null> {
  const users = await usersCollection();
  return users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: data },
    { returnDocument: "after" }
  );
}
