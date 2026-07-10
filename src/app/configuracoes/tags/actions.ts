"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { tags } from "@/db/schema";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type TagFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idle: TagFormState = { status: "idle" };

async function nameConflicts(name: string, excludeId?: string) {
  const rows = await db.select({ id: tags.id, name: tags.name }).from(tags);
  const normalized = name.trim().toLowerCase();
  return rows.some(
    (row) => row.id !== excludeId && row.name.trim().toLowerCase() === normalized
  );
}

export async function createTagAction(
  _prevState: TagFormState,
  formData: FormData
): Promise<TagFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const name = formData.get("name");
  const color = formData.get("color");

  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  if (await nameConflicts(name)) {
    return { status: "error", message: "Já existe uma tag com esse nome." };
  }

  await db.insert(tags).values({
    name: name.trim(),
    color: typeof color === "string" && color ? color : null,
  });

  revalidatePath("/configuracoes/tags");
  return idle;
}

export type QuickCreateTagResult =
  | { ok: true; tag: { id: string; name: string; color: string | null } }
  | { ok: false; message: string };

// Variante de createTagAction que devolve a tag criada (id incluso) em vez
// de só um status — usada pela criação rápida embutida nas telas de
// mapeamento (webhook/importação), que precisa selecionar a tag na hora.
export async function createTagQuickAction(
  name: string,
  color: string | null
): Promise<QuickCreateTagResult> {
  if (!(await requireAdmin())) {
    return { ok: false, message: "Acesso negado." };
  }
  if (!name.trim()) {
    return { ok: false, message: "Nome é obrigatório." };
  }
  if (await nameConflicts(name)) {
    return { ok: false, message: "Já existe uma tag com esse nome." };
  }

  const [created] = await db
    .insert(tags)
    .values({ name: name.trim(), color: color || null })
    .returning({ id: tags.id, name: tags.name, color: tags.color });

  revalidatePath("/configuracoes/tags");
  return { ok: true, tag: created };
}

export async function updateTagAction(
  _prevState: TagFormState,
  formData: FormData
): Promise<TagFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  const name = formData.get("name");
  const color = formData.get("color");

  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Tag inválida." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  if (await nameConflicts(name, id)) {
    return { status: "error", message: "Já existe uma tag com esse nome." };
  }

  await db
    .update(tags)
    .set({
      name: name.trim(),
      color: typeof color === "string" && color ? color : null,
    })
    .where(eq(tags.id, id));

  revalidatePath("/configuracoes/tags");
  return idle;
}

export async function deleteTagAction(
  _prevState: TagFormState,
  formData: FormData
): Promise<TagFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Tag inválida." };
  }

  // FKs de deal_tags/contact_tags são ON DELETE CASCADE — a associação some
  // junto, o aviso no modal (contagem de uso) já é a confirmação exigida.
  await db.delete(tags).where(eq(tags.id, id));

  revalidatePath("/configuracoes/tags");
  return idle;
}
