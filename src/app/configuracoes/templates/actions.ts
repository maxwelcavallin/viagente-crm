"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { emailTemplates, messageTemplateItems, messageTemplates, stageTasks } from "@/db/schema";
import { extractVariables } from "@/lib/templates";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type TemplateFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idle: TemplateFormState = { status: "idle" };

// Um template é um conjunto ORDENADO de mensagens separadas (ver
// message_template_items no schema) — o form manda o conjunto inteiro
// serializado em JSON (ver template-form-dialog.tsx), cada item já com seu
// anexo (se houver) enviado pro R2 antes do submit. Item sem conteúdo e sem
// anexo é descartado silenciosamente (mesmo padrão de "pelo menos um dos
// dois" já usado pra telefone/email de contato, mas aqui por mensagem).
type TemplateItemInput = {
  id: string;
  content: string;
  mediaType: string | null;
  mediaFileName: string | null;
};

function parseItems(formData: FormData): TemplateItemInput[] | null {
  const raw = formData.get("items");
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (it): it is TemplateItemInput =>
        Boolean(it) &&
        typeof it === "object" &&
        typeof (it as TemplateItemInput).id === "string" &&
        typeof (it as TemplateItemInput).content === "string" &&
        ((it as TemplateItemInput).mediaType === null ||
          typeof (it as TemplateItemInput).mediaType === "string") &&
        ((it as TemplateItemInput).mediaFileName === null ||
          typeof (it as TemplateItemInput).mediaFileName === "string")
    );
  } catch {
    return null;
  }
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
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Template inválido." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  const parsedItems = parseItems(formData);
  if (!parsedItems) {
    return { status: "error", message: "Mensagens inválidas." };
  }
  const items = parsedItems.filter((it) => it.content.trim() || it.mediaType);
  if (items.length === 0) {
    return { status: "error", message: "Adicione pelo menos uma mensagem com conteúdo e/ou anexo." };
  }

  await db.insert(messageTemplates).values({ id, name: name.trim() });
  await db.insert(messageTemplateItems).values(
    items.map((it, index) => ({
      id: it.id,
      templateId: id,
      order: index,
      content: it.content.trim(),
      mediaType: it.mediaType,
      mediaFileName: it.mediaFileName,
    }))
  );

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
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Template inválido." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  const parsedItems = parseItems(formData);
  if (!parsedItems) {
    return { status: "error", message: "Mensagens inválidas." };
  }
  const items = parsedItems.filter((it) => it.content.trim() || it.mediaType);
  if (items.length === 0) {
    return { status: "error", message: "Adicione pelo menos uma mensagem com conteúdo e/ou anexo." };
  }

  await db.update(messageTemplates).set({ name: name.trim() }).where(eq(messageTemplates.id, id));

  // Substitui o conjunto inteiro (apaga tudo, insere de novo com a ordem
  // atual do form) — mais simples que sincronizar item a item, e o id de
  // cada item já vem estável do cliente (ver template-form-dialog.tsx), então
  // a chave do anexo no R2 (`templates/${itemId}`) continua válida mesmo
  // apagando e recriando a linha.
  const del = db.delete(messageTemplateItems).where(eq(messageTemplateItems.templateId, id));
  const inserts = items.map((it, index) =>
    db.insert(messageTemplateItems).values({
      id: it.id,
      templateId: id,
      order: index,
      content: it.content.trim(),
      mediaType: it.mediaType,
      mediaFileName: it.mediaFileName,
    })
  );
  await db.batch([
    del,
    ...(inserts as [(typeof inserts)[number], ...(typeof inserts)[number][]]),
  ]);

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
  // message_template_items é apagado em cascata (onDelete: "cascade").
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
