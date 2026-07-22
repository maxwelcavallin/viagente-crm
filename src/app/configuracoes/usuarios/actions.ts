"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { userPipelineVisibility, users } from "@/db/schema";
import { generateTempPassword, hashPassword } from "@/lib/password";

type PipelineSettingInput = { id: string; visible: boolean };

function parsePipelineSettings(raw: FormDataEntryValue | null): PipelineSettingInput[] | null {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (
      !parsed.every(
        (p) =>
          p &&
          typeof p.id === "string" &&
          typeof p.visible === "boolean"
      )
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

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
  const restrictToOwnRecords = formData.get("restrictToOwnRecords") === "true";
  const defaultPipelineIdRaw = formData.get("defaultPipelineId");
  const defaultPipelineId =
    typeof defaultPipelineIdRaw === "string" && defaultPipelineIdRaw ? defaultPipelineIdRaw : null;
  const pipelineSettings = parsePipelineSettings(formData.get("pipelineSettings"));

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
  if (pipelineSettings === null) {
    return { status: "error", message: "Configuração de pipelines inválida." };
  }
  if (
    defaultPipelineId &&
    !pipelineSettings.some((p) => p.id === defaultPipelineId && p.visible)
  ) {
    return {
      status: "error",
      message: "A pipeline padrão precisa estar entre as pipelines visíveis.",
    };
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
    .set({
      name: name.trim(),
      email: normalizedEmail,
      role,
      restrictToOwnRecords,
      defaultPipelineId,
    })
    .where(eq(users.id, id));

  if (pipelineSettings.length > 0) {
    const upserts = pipelineSettings.map((p, index) =>
      db
        .insert(userPipelineVisibility)
        .values({ userId: id, pipelineId: p.id, visible: p.visible, order: index })
        .onConflictDoUpdate({
          target: [userPipelineVisibility.userId, userPipelineVisibility.pipelineId],
          set: { visible: p.visible, order: index },
        })
    );
    await db.batch(upserts as [(typeof upserts)[number], ...(typeof upserts)[number][]]);
  }

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
