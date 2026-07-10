"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { tagAutomations } from "@/db/schema";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type TagAutomationFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idleState: TagAutomationFormState = { status: "idle" };

function parseDelayMinutes(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  return Math.floor(minutes);
}

type TagAutomationFields = {
  tagId: string;
  title: string;
  type: "mensagem" | "ligacao" | "agendamento" | "generica";
  trigger: "tag_adicionada" | "dias_apos_tag";
  delayMinutes: number | null;
  messageTemplateId: string | null;
  autoSend: boolean;
  autoSendChannelId: string | null;
};

async function readTagAutomationFields(
  formData: FormData
): Promise<TagAutomationFields | { error: string }> {
  const tagId = formData.get("tagId");
  const title = formData.get("title");
  const type = formData.get("type");
  const trigger = formData.get("trigger");
  const delayMinutes = parseDelayMinutes(formData.get("delayMinutes"));
  const messageTemplateId = formData.get("messageTemplateId");
  const autoSend = formData.get("autoSend") === "true";
  const autoSendChannelIdRaw = formData.get("autoSendChannelId");
  const autoSendChannelId =
    typeof autoSendChannelIdRaw === "string" && autoSendChannelIdRaw
      ? autoSendChannelIdRaw
      : null;

  if (typeof tagId !== "string" || !tagId) {
    return { error: "Selecione uma tag." };
  }
  if (typeof title !== "string" || !title.trim()) {
    return { error: "Título é obrigatório." };
  }
  if (type !== "mensagem" && type !== "ligacao" && type !== "agendamento" && type !== "generica") {
    return { error: "Tipo inválido." };
  }
  if (trigger !== "tag_adicionada" && trigger !== "dias_apos_tag") {
    return { error: "Gatilho inválido." };
  }
  if (trigger === "dias_apos_tag" && delayMinutes == null) {
    return { error: "Informe quanto tempo após a tag pra disparar." };
  }
  if (type === "mensagem" && (typeof messageTemplateId !== "string" || !messageTemplateId)) {
    return { error: "Selecione um template para automações do tipo mensagem." };
  }
  if (type === "mensagem" && autoSend && !autoSendChannelId) {
    return { error: "Selecione um canal pra envio automático." };
  }

  return {
    tagId,
    title: title.trim(),
    type: type as "mensagem" | "ligacao" | "agendamento" | "generica",
    trigger: trigger as "tag_adicionada" | "dias_apos_tag",
    delayMinutes: trigger === "dias_apos_tag" ? delayMinutes : null,
    messageTemplateId: type === "mensagem" ? (messageTemplateId as string) : null,
    autoSend: type === "mensagem" ? autoSend : false,
    autoSendChannelId: type === "mensagem" && autoSend ? autoSendChannelId : null,
  };
}

export async function createTagAutomationAction(
  _prevState: TagAutomationFormState,
  formData: FormData
): Promise<TagAutomationFormState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const fields = await readTagAutomationFields(formData);
  if ("error" in fields) return { status: "error", message: fields.error };

  await db.insert(tagAutomations).values(fields);

  revalidatePath("/configuracoes/automacoes");
  return idleState;
}

export async function updateTagAutomationAction(
  _prevState: TagAutomationFormState,
  formData: FormData
): Promise<TagAutomationFormState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Automação inválida." };
  }

  const fields = await readTagAutomationFields(formData);
  if ("error" in fields) return { status: "error", message: fields.error };

  await db.update(tagAutomations).set(fields).where(eq(tagAutomations.id, id));

  revalidatePath("/configuracoes/automacoes");
  return idleState;
}

export async function deleteTagAutomationAction(
  _prevState: TagAutomationFormState,
  formData: FormData
): Promise<TagAutomationFormState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Automação inválida." };
  }

  await db.delete(tagAutomations).where(eq(tagAutomations.id, id));

  revalidatePath("/configuracoes/automacoes");
  return idleState;
}
