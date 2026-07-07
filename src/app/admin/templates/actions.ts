"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { messageTemplates, stageTasks } from "@/db/schema";
import { extractVariables } from "@/lib/templates";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type TemplateFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idle: TemplateFormState = { status: "idle" };

export async function createTemplateAction(
  _prevState: TemplateFormState,
  formData: FormData
): Promise<TemplateFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const name = formData.get("name");
  const content = formData.get("content");
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  if (typeof content !== "string" || !content.trim()) {
    return { status: "error", message: "Conteúdo é obrigatório." };
  }

  await db.insert(messageTemplates).values({
    name: name.trim(),
    content: content.trim(),
    variables: extractVariables(content),
  });

  revalidatePath("/admin/templates");
  return idle;
}

export async function updateTemplateAction(
  _prevState: TemplateFormState,
  formData: FormData
): Promise<TemplateFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  const name = formData.get("name");
  const content = formData.get("content");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Template inválido." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  if (typeof content !== "string" || !content.trim()) {
    return { status: "error", message: "Conteúdo é obrigatório." };
  }

  await db
    .update(messageTemplates)
    .set({
      name: name.trim(),
      content: content.trim(),
      variables: extractVariables(content),
    })
    .where(eq(messageTemplates.id, id));

  revalidatePath("/admin/templates");
  return idle;
}

export async function deleteTemplateAction(
  _prevState: TemplateFormState,
  formData: FormData
): Promise<TemplateFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Template inválido." };
  }

  await db
    .update(stageTasks)
    .set({ messageTemplateId: null })
    .where(eq(stageTasks.messageTemplateId, id));
  await db.delete(messageTemplates).where(eq(messageTemplates.id, id));

  revalidatePath("/admin/templates");
  revalidatePath("/admin/pipelines");
  return idle;
}
