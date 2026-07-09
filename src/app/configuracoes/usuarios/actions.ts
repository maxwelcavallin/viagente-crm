"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { generateTempPassword, hashPassword } from "@/lib/password";

export type CreateUserState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; name: string; email: string; tempPassword: string };

export async function createUserAction(
  _prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { status: "error", message: "Acesso negado." };
  }

  const name = formData.get("name");
  const email = formData.get("email");
  const role = formData.get("role");

  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  if (typeof email !== "string" || !email.trim()) {
    return { status: "error", message: "Email é obrigatório." };
  }
  if (role !== "admin" && role !== "atendente") {
    return { status: "error", message: "Role inválida." };
  }

  const normalizedEmail = email.toLowerCase().trim();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  if (existing) {
    return {
      status: "error",
      message: "Já existe um usuário com esse email.",
    };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await db.insert(users).values({
    name: name.trim(),
    email: normalizedEmail,
    role,
    passwordHash,
    mustChangePassword: true,
  });

  revalidatePath("/configuracoes/usuarios");

  return {
    status: "success",
    name: name.trim(),
    email: normalizedEmail,
    tempPassword,
  };
}
