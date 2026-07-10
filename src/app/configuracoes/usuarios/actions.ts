"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { generateTempPassword, hashPassword } from "@/lib/password";

export type CreateUserState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; name: string; email: string; tempPassword: string };

export type UpdateUserState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function updateUserAction(
  _prevState: UpdateUserState,
  formData: FormData
): Promise<UpdateUserState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  const name = formData.get("name");
  const email = formData.get("email");
  const role = formData.get("role");

  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Usuário inválido." };
  }
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
  if (existing && existing.id !== id) {
    return {
      status: "error",
      message: "Já existe um usuário com esse email.",
    };
  }

  if (role !== "admin" && id === session.user.id) {
    return {
      status: "error",
      message: "Você não pode remover sua própria permissão de admin.",
    };
  }

  if (role !== "admin") {
    const [current] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (current?.role === "admin") {
      const [{ adminCount }] = await db
        .select({ adminCount: count(users.id) })
        .from(users)
        .where(eq(users.role, "admin"));
      if (adminCount <= 1) {
        return {
          status: "error",
          message: "Não é possível remover o último admin do sistema.",
        };
      }
    }
  }

  await db
    .update(users)
    .set({ name: name.trim(), email: normalizedEmail, role })
    .where(eq(users.id, id));

  revalidatePath("/configuracoes/usuarios");
  return { status: "idle" };
}

export type DeleteUserState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function deleteUserAction(
  _prevState: DeleteUserState,
  formData: FormData
): Promise<DeleteUserState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Usuário inválido." };
  }

  if (id === session.user.id) {
    return { status: "error", message: "Você não pode excluir sua própria conta." };
  }

  const [target] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) return { status: "error", message: "Usuário não encontrado." };

  if (target.role === "admin") {
    const [{ adminCount }] = await db
      .select({ adminCount: count(users.id) })
      .from(users)
      .where(eq(users.role, "admin"));
    if (adminCount <= 1) {
      return {
        status: "error",
        message: "Não é possível excluir o último admin do sistema.",
      };
    }
  }

  await db.delete(users).where(eq(users.id, id));

  revalidatePath("/configuracoes/usuarios");
  return { status: "idle" };
}

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
