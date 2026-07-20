"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { webhookConfigs } from "@/db/schema";
import {
  logInboundWebhook,
  processInboundPayload,
  type InboundProcessResult,
} from "@/lib/webhook-inbound";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type WebhookFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; webhookId: string; secretToken?: string };

export async function createInboundWebhookAction(
  _prevState: WebhookFormState,
  formData: FormData
): Promise<WebhookFormState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const name = formData.get("name");
  const defaultPipelineId = formData.get("defaultPipelineId");
  const defaultStageId = formData.get("defaultStageId");

  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  if (typeof defaultPipelineId !== "string" || !defaultPipelineId) {
    return { status: "error", message: "Selecione a pipeline padrão." };
  }
  if (typeof defaultStageId !== "string" || !defaultStageId) {
    return { status: "error", message: "Selecione a etapa padrão." };
  }

  const secretToken = randomBytes(24).toString("hex");

  const [created] = await db
    .insert(webhookConfigs)
    .values({
      name: name.trim(),
      direction: "entrada",
      sourcePlatform: name.trim(),
      secretToken,
      defaultPipelineId,
      defaultStageId,
      fieldMapping: {},
    })
    .returning({ id: webhookConfigs.id });

  revalidatePath("/configuracoes/webhooks");
  return { status: "success", webhookId: created.id, secretToken };
}

export async function createOutboundWebhookAction(
  _prevState: WebhookFormState,
  formData: FormData
): Promise<WebhookFormState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const name = formData.get("name");
  const targetUrl = formData.get("targetUrl");
  const events = formData.getAll("events").filter((v): v is string => typeof v === "string");
  const pipelineId = formData.get("pipelineId");
  const stageId = formData.get("stageId");
  const tagId = formData.get("tagId");

  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  if (typeof targetUrl !== "string" || !targetUrl.trim()) {
    return { status: "error", message: "URL de destino é obrigatória." };
  }
  try {
    new URL(targetUrl);
  } catch {
    return { status: "error", message: "URL de destino inválida." };
  }
  if (events.length === 0) {
    return { status: "error", message: "Selecione ao menos um evento." };
  }

  const [created] = await db
    .insert(webhookConfigs)
    .values({
      name: name.trim(),
      direction: "saida",
      targetUrl: targetUrl.trim(),
      events,
      pipelineId: typeof pipelineId === "string" && pipelineId ? pipelineId : null,
      stageId: typeof stageId === "string" && stageId ? stageId : null,
      tagId: typeof tagId === "string" && tagId ? tagId : null,
      fieldMapping: {},
    })
    .returning({ id: webhookConfigs.id });

  revalidatePath("/configuracoes/webhooks");
  return { status: "success", webhookId: created.id };
}

export async function updateOutboundWebhookAction(
  _prevState: WebhookFormState,
  formData: FormData
): Promise<WebhookFormState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const id = formData.get("id");
  const name = formData.get("name");
  const targetUrl = formData.get("targetUrl");
  const events = formData.getAll("events").filter((v): v is string => typeof v === "string");
  const pipelineId = formData.get("pipelineId");
  const stageId = formData.get("stageId");
  const tagId = formData.get("tagId");

  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Webhook inválido." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  if (typeof targetUrl !== "string" || !targetUrl.trim()) {
    return { status: "error", message: "URL de destino é obrigatória." };
  }
  try {
    new URL(targetUrl);
  } catch {
    return { status: "error", message: "URL de destino inválida." };
  }
  if (events.length === 0) {
    return { status: "error", message: "Selecione ao menos um evento." };
  }

  await db
    .update(webhookConfigs)
    .set({
      name: name.trim(),
      targetUrl: targetUrl.trim(),
      events,
      pipelineId: typeof pipelineId === "string" && pipelineId ? pipelineId : null,
      stageId: typeof stageId === "string" && stageId ? stageId : null,
      tagId: typeof tagId === "string" && tagId ? tagId : null,
    })
    .where(eq(webhookConfigs.id, id));

  revalidatePath("/configuracoes/webhooks");
  revalidatePath(`/configuracoes/webhooks/${id}`);
  return { status: "success", webhookId: id };
}

export async function updateInboundWebhookAction(
  _prevState: WebhookFormState,
  formData: FormData
): Promise<WebhookFormState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const id = formData.get("id");
  const name = formData.get("name");
  const defaultPipelineId = formData.get("defaultPipelineId");
  const defaultStageId = formData.get("defaultStageId");

  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Webhook inválido." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  if (typeof defaultPipelineId !== "string" || !defaultPipelineId) {
    return { status: "error", message: "Selecione a pipeline padrão." };
  }
  if (typeof defaultStageId !== "string" || !defaultStageId) {
    return { status: "error", message: "Selecione a etapa padrão." };
  }

  await db
    .update(webhookConfigs)
    .set({ name: name.trim(), defaultPipelineId, defaultStageId })
    .where(eq(webhookConfigs.id, id));

  revalidatePath("/configuracoes/webhooks");
  revalidatePath(`/configuracoes/webhooks/${id}`);
  return { status: "success", webhookId: id };
}

export async function updateFieldMappingAction(
  webhookId: string,
  mapping: Record<string, string>
): Promise<{ ok: boolean }> {
  if (!(await requireAdmin())) return { ok: false };

  await db
    .update(webhookConfigs)
    .set({ fieldMapping: mapping })
    .where(eq(webhookConfigs.id, webhookId));

  revalidatePath(`/configuracoes/webhooks/${webhookId}`);
  return { ok: true };
}

// Tags separadas do mapeamento de campos (Etapa 13): aplicadas estaticamente
// a todo contato/negócio criado por este webhook — não vêm do payload.
export async function updateWebhookTagsAction(
  webhookId: string,
  contactTagIds: string[],
  dealTagIds: string[]
): Promise<{ ok: boolean }> {
  if (!(await requireAdmin())) return { ok: false };

  await db
    .update(webhookConfigs)
    .set({ contactTagIds, dealTagIds })
    .where(eq(webhookConfigs.id, webhookId));

  revalidatePath(`/configuracoes/webhooks/${webhookId}`);
  return { ok: true };
}

export async function toggleWebhookActiveAction(
  id: string,
  active: boolean
): Promise<{ ok: boolean }> {
  if (!(await requireAdmin())) return { ok: false };

  await db.update(webhookConfigs).set({ active }).where(eq(webhookConfigs.id, id));

  revalidatePath("/configuracoes/webhooks");
  revalidatePath(`/configuracoes/webhooks/${id}`);
  return { ok: true };
}

export type DeleteWebhookState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function deleteWebhookAction(
  _prevState: DeleteWebhookState,
  formData: FormData
): Promise<DeleteWebhookState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const id = formData.get("id");
  const redirectTo = formData.get("redirectTo");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Webhook inválido." };
  }

  await db.delete(webhookConfigs).where(eq(webhookConfigs.id, id));

  revalidatePath("/configuracoes/webhooks");
  if (typeof redirectTo === "string" && redirectTo) {
    redirect(redirectTo);
  }
  return { status: "idle" };
}

export type TestWebhookResult =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "result"; result: InboundProcessResult };

export async function testInboundWebhookAction(
  webhookId: string,
  payloadText: string
): Promise<TestWebhookResult> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  let payload: unknown;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    return { status: "error", message: "JSON inválido." };
  }

  const [config] = await db
    .select()
    .from(webhookConfigs)
    .where(eq(webhookConfigs.id, webhookId))
    .limit(1);
  if (!config) return { status: "error", message: "Webhook não encontrado." };

  const result = await processInboundPayload(config, payload);
  await logInboundWebhook(config.id, payload, result);

  revalidatePath(`/configuracoes/webhooks/${webhookId}`);
  return { status: "result", result };
}
