"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { emailTemplates, messageTemplates, stageTasks } from "@/db/schema";
import { extractVariables } from "@/lib/templates";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type TemplateFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idle: TemplateFormState = { status: "idle" };

// mediaType vem do upload já concluído no cliente (ver template-form-dialog.tsx
// — o arquivo/áudio já está no R2 antes do form ser enviado, aqui só grava a
// referência). Conteúdo deixa de ser obrigatório sozinho: precisa de texto
// e/ou anexo, nunca os dois vazios (mesmo padrão de "pelo menos um dos dois"
// já usado pra telefone/email de contato).
function readMediaFields(formData: FormData): { mediaType: string | null; mediaFileName: string | null } {
  const mediaType = formData.get("mediaType");
  const mediaFileName = formData.get("mediaFileName");
  return {
    mediaType: typeof mediaType === "string" && mediaType ? mediaType : null,
    mediaFileName: typeof mediaFileName === "string" && mediaFileName ? mediaFileName : null,
  };
}

export async function createTemplateAction(
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
  if (typeof content !== "string") {
    return { status: "error", message: "Conteúdo inválido." };
  }
  const { mediaType, mediaFileName } = readMediaFields(formData);
  if (!content.trim() && !mediaType) {
    return { status: "error", message: "Informe o conteúdo e/ou um anexo." };
  }

  await db.insert(messageTemplates).values({
    id,
    name: name.trim(),
    content: content.trim(),
    variables: extractVariables(content),
    mediaType,
    mediaFileName,
  });

  revalidatePath("/configuracoes/templates");
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
  if (typeof content !== "string") {
    return { status: "error", message: "Conteúdo inválido." };
  }
  const { mediaType, mediaFileName } = readMediaFields(formData);
  if (!content.trim() && !mediaType) {
    return { status: "error", message: "Informe o conteúdo e/ou um anexo." };
  }

  await db
    .update(messageTemplates)
    .set({
      name: name.trim(),
      content: content.trim(),
      variables: extractVariables(content),
      mediaType,
      mediaFileName,
    })
    .where(eq(messageTemplates.id, id));

  revalidatePath("/configuracoes/templates");
  revalidatePath("/configuracoes/pipelines");
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

  revalidatePath("/configuracoes/templates");
  revalidatePath("/configuracoes/pipelines");
  return idle;
}

export async function createEmailTemplateAction(
  _prevState: TemplateFormState,
  formData: FormData
): Promise<TemplateFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const name = formData.get("name");
  const subject = formData.get("subject");
  const content = formData.get("content");
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  if (typeof subject !== "string" || !subject.trim()) {
    return { status: "error", message: "Assunto é obrigatório." };
  }
  if (typeof content !== "string" || !content.trim()) {
    return { status: "error", message: "Corpo é obrigatório." };
  }

  await db.insert(emailTemplates).values({
    name: name.trim(),
    subject: subject.trim(),
    content: content.trim(),
    variables: extractVariables(`${subject} ${content}`),
  });

  revalidatePath("/configuracoes/templates");
  return idle;
}

export async function updateEmailTemplateAction(
  _prevState: TemplateFormState,
  formData: FormData
): Promise<TemplateFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  const name = formData.get("name");
  const subject = formData.get("subject");
  const content = formData.get("content");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Template inválido." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  if (typeof subject !== "string" || !subject.trim()) {
    return { status: "error", message: "Assunto é obrigatório." };
  }
  if (typeof content !== "string" || !content.trim()) {
    return { status: "error", message: "Corpo é obrigatório." };
  }

  await db
    .update(emailTemplates)
    .set({
      name: name.trim(),
      subject: subject.trim(),
      content: content.trim(),
      variables: extractVariables(`${subject} ${content}`),
    })
    .where(eq(emailTemplates.id, id));

  revalidatePath("/configuracoes/templates");
  return idle;
}

export async function deleteEmailTemplateAction(
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
    .set({ emailTemplateId: null })
    .where(eq(stageTasks.emailTemplateId, id));
  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));

  revalidatePath("/configuracoes/templates");
  revalidatePath("/configuracoes/pipelines");
  return idle;
}
