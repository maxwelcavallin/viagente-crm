import { randomBytes } from "node:crypto";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  automationSequences,
  automationSequenceSteps,
  customFieldDefinitions,
  deals,
  emailTemplates,
  instagramChannels,
  lossReasons,
  messageTemplates,
  pipelines,
  stages,
  stageTasks,
  tagAutomations,
  tags,
  webhookConfigs,
  whatsappChannels,
} from "@/db/schema";
import { logApiWrite } from "@/lib/api-audit";
import { hasAdminScope, type AuthenticatedApiKey } from "@/lib/api-keys";
import type { ApiResult } from "@/lib/api-v1";
import { extractVariables } from "@/lib/templates";

const FORBIDDEN: { ok: false; status: 403; error: string } = {
  ok: false,
  status: 403,
  error: "Chave sem escopo admin — ação de configuração requer chave admin.",
};

function requireAdminScope(apiKey: AuthenticatedApiKey): { ok: false; status: 403; error: string } | null {
  return hasAdminScope(apiKey) ? null : FORBIDDEN;
}

// ---------- Pipelines ----------

export async function listPipelinesForApiKey(
  apiKey: AuthenticatedApiKey
): Promise<ApiResult<(typeof pipelines.$inferSelect)[]>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const rows = await db.select().from(pipelines).orderBy(asc(pipelines.order));
  return { ok: true, data: rows };
}

export async function createPipelineForApiKey(
  apiKey: AuthenticatedApiKey,
  params: { name: string }
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  if (!params.name.trim()) return { ok: false, status: 400, error: "name é obrigatório." };

  const existing = await db.select({ order: pipelines.order }).from(pipelines);
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((p) => p.order)) + 1 : 0;

  const [created] = await db
    .insert(pipelines)
    .values({ name: params.name.trim(), order: nextOrder })
    .returning({ id: pipelines.id });

  void logApiWrite(apiKey.id, "pipeline", created.id, "create");
  return { ok: true, data: { id: created.id } };
}

export async function updatePipelineForApiKey(
  apiKey: AuthenticatedApiKey,
  pipelineId: string,
  params: { name: string }
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  if (!params.name.trim()) return { ok: false, status: 400, error: "name é obrigatório." };

  await db.update(pipelines).set({ name: params.name.trim() }).where(eq(pipelines.id, pipelineId));
  void logApiWrite(apiKey.id, "pipeline", pipelineId, "update");
  return { ok: true, data: { id: pipelineId } };
}

export async function deletePipelineForApiKey(
  apiKey: AuthenticatedApiKey,
  pipelineId: string
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;

  const [{ dealCount }] = await db.select({ dealCount: count() }).from(deals).where(eq(deals.pipelineId, pipelineId));
  if (dealCount > 0) {
    return {
      ok: false,
      status: 400,
      error: `Essa pipeline tem ${dealCount} negócio(s) — mova ou exclua antes de excluir a pipeline.`,
    };
  }

  await db.delete(pipelines).where(eq(pipelines.id, pipelineId));
  void logApiWrite(apiKey.id, "pipeline", pipelineId, "delete");
  return { ok: true, data: { id: pipelineId } };
}

// ---------- Stages ----------

async function stageNameConflicts(pipelineId: string, name: string, excludeStageId?: string) {
  const rows = await db.select({ id: stages.id, name: stages.name }).from(stages).where(eq(stages.pipelineId, pipelineId));
  const normalized = name.trim().toLowerCase();
  return rows.some((row) => row.id !== excludeStageId && row.name.trim().toLowerCase() === normalized);
}

export async function listStagesForApiKey(
  apiKey: AuthenticatedApiKey,
  pipelineId: string
): Promise<ApiResult<(typeof stages.$inferSelect)[]>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const rows = await db.select().from(stages).where(eq(stages.pipelineId, pipelineId)).orderBy(asc(stages.order));
  return { ok: true, data: rows };
}

export async function createStageForApiKey(
  apiKey: AuthenticatedApiKey,
  params: { pipelineId: string; name: string; color?: string | null }
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  if (!params.name.trim()) return { ok: false, status: 400, error: "name é obrigatório." };
  if (await stageNameConflicts(params.pipelineId, params.name)) {
    return { ok: false, status: 400, error: "Já existe uma etapa com esse nome nesta pipeline." };
  }

  const existing = await db.select({ order: stages.order }).from(stages).where(eq(stages.pipelineId, params.pipelineId));
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((s) => s.order)) + 1 : 0;

  const [created] = await db
    .insert(stages)
    .values({ pipelineId: params.pipelineId, name: params.name.trim(), color: params.color ?? null, order: nextOrder })
    .returning({ id: stages.id });

  void logApiWrite(apiKey.id, "stage", created.id, "create");
  return { ok: true, data: { id: created.id } };
}

export async function updateStageForApiKey(
  apiKey: AuthenticatedApiKey,
  stageId: string,
  params: { name: string; color?: string | null }
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  if (!params.name.trim()) return { ok: false, status: 400, error: "name é obrigatório." };

  const [current] = await db.select({ pipelineId: stages.pipelineId }).from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!current) return { ok: false, status: 404, error: "Etapa não encontrada." };
  if (await stageNameConflicts(current.pipelineId, params.name, stageId)) {
    return { ok: false, status: 400, error: "Já existe uma etapa com esse nome nesta pipeline." };
  }

  await db.update(stages).set({ name: params.name.trim(), color: params.color ?? null }).where(eq(stages.id, stageId));
  void logApiWrite(apiKey.id, "stage", stageId, "update");
  return { ok: true, data: { id: stageId } };
}

export async function deleteStageForApiKey(
  apiKey: AuthenticatedApiKey,
  stageId: string
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;

  const [{ dealCount }] = await db.select({ dealCount: count() }).from(deals).where(eq(deals.stageId, stageId));
  if (dealCount > 0) {
    return {
      ok: false,
      status: 400,
      error: `${dealCount} negócio(s) estão nesta etapa — mova-os antes de excluir.`,
    };
  }

  await db.delete(stages).where(eq(stages.id, stageId));
  void logApiWrite(apiKey.id, "stage", stageId, "delete");
  return { ok: true, data: { id: stageId } };
}

// ---------- Motivos de perda ----------
// Catálogo por pipeline (ver deals.lossReasonId) — lido aqui pra permitir
// que quem chama editar_negocio/updateDealForApiKey com status "perdido"
// descubra um lossReasonId válido antes de mandar a chamada.
export async function listLossReasonsForApiKey(
  apiKey: AuthenticatedApiKey,
  pipelineId: string
): Promise<ApiResult<(typeof lossReasons.$inferSelect)[]>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const rows = await db
    .select()
    .from(lossReasons)
    .where(eq(lossReasons.pipelineId, pipelineId))
    .orderBy(asc(lossReasons.order));
  return { ok: true, data: rows };
}

// Espelha createLossReasonAction (src/app/configuracoes/pipelines/[id]/actions.ts)
// — mesma regra de lá: sem checagem de nome duplicado (motivos de perda não
// são únicos por label), só acumula no fim da ordem da pipeline.
export async function createLossReasonForApiKey(
  apiKey: AuthenticatedApiKey,
  params: { pipelineId: string; label: string }
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  if (!params.label.trim()) return { ok: false, status: 400, error: "label é obrigatório." };

  const existing = await db
    .select({ order: lossReasons.order })
    .from(lossReasons)
    .where(eq(lossReasons.pipelineId, params.pipelineId));
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.order)) + 1 : 0;

  const [created] = await db
    .insert(lossReasons)
    .values({ pipelineId: params.pipelineId, label: params.label.trim(), order: nextOrder })
    .returning({ id: lossReasons.id });

  void logApiWrite(apiKey.id, "loss_reason", created.id, "create");
  return { ok: true, data: { id: created.id } };
}

// ---------- Stage tasks (tarefas automáticas de etapa) ----------

type StageTaskInput = {
  stageId: string;
  title: string;
  type: "mensagem" | "ligacao" | "agendamento" | "generica" | "email";
  messageTemplateId?: string | null;
  emailTemplateId?: string | null;
  daysToComplete?: number | null;
  triggerDelayMinutes?: number | null;
  isAutomatic?: boolean;
  autoSend?: boolean;
  autoSendChannelId?: string | null;
};

function validateStageTaskInput(input: StageTaskInput): { error: string } | null {
  if (!input.title.trim()) return { error: "title é obrigatório." };
  if (input.type === "mensagem" && !input.messageTemplateId) {
    return { error: "messageTemplateId é obrigatório para type='mensagem'." };
  }
  if (input.type === "mensagem" && input.autoSend && !input.autoSendChannelId) {
    return { error: "autoSendChannelId é obrigatório quando autoSend=true." };
  }
  return null;
}

export async function listStageTasksForApiKey(
  apiKey: AuthenticatedApiKey,
  stageId: string
): Promise<ApiResult<(typeof stageTasks.$inferSelect)[]>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const rows = await db.select().from(stageTasks).where(eq(stageTasks.stageId, stageId)).orderBy(asc(stageTasks.order));
  return { ok: true, data: rows };
}

export async function createStageTaskForApiKey(
  apiKey: AuthenticatedApiKey,
  params: StageTaskInput
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const invalid = validateStageTaskInput(params);
  if (invalid) return { ok: false, status: 400, error: invalid.error };

  const existing = await db.select({ order: stageTasks.order }).from(stageTasks).where(eq(stageTasks.stageId, params.stageId));
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((s) => s.order)) + 1 : 0;

  const [created] = await db
    .insert(stageTasks)
    .values({
      stageId: params.stageId,
      title: params.title.trim(),
      type: params.type,
      messageTemplateId: params.type === "mensagem" ? (params.messageTemplateId ?? null) : null,
      emailTemplateId: params.type === "email" ? (params.emailTemplateId ?? null) : null,
      order: nextOrder,
      daysToComplete: params.daysToComplete ?? null,
      triggerDelayMinutes: params.triggerDelayMinutes ?? null,
      isAutomatic: params.isAutomatic ?? true,
      autoSend: params.type === "mensagem" ? (params.autoSend ?? false) : false,
      autoSendChannelId: params.type === "mensagem" && params.autoSend ? (params.autoSendChannelId ?? null) : null,
    })
    .returning({ id: stageTasks.id });

  void logApiWrite(apiKey.id, "stage_task", created.id, "create");
  return { ok: true, data: { id: created.id } };
}

export async function updateStageTaskForApiKey(
  apiKey: AuthenticatedApiKey,
  stageTaskId: string,
  params: Omit<StageTaskInput, "stageId" | "type">
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;

  const [current] = await db.select({ type: stageTasks.type }).from(stageTasks).where(eq(stageTasks.id, stageTaskId)).limit(1);
  if (!current) return { ok: false, status: 404, error: "Tarefa não encontrada." };

  const invalid = validateStageTaskInput({ ...params, stageId: "", type: current.type, title: params.title });
  if (invalid) return { ok: false, status: 400, error: invalid.error };

  await db
    .update(stageTasks)
    .set({
      title: params.title.trim(),
      messageTemplateId: current.type === "mensagem" ? (params.messageTemplateId ?? null) : null,
      emailTemplateId: current.type === "email" ? (params.emailTemplateId ?? null) : null,
      daysToComplete: params.daysToComplete ?? null,
      triggerDelayMinutes: params.triggerDelayMinutes ?? null,
      isAutomatic: params.isAutomatic ?? true,
      autoSend: current.type === "mensagem" ? (params.autoSend ?? false) : false,
      autoSendChannelId: current.type === "mensagem" && params.autoSend ? (params.autoSendChannelId ?? null) : null,
    })
    .where(eq(stageTasks.id, stageTaskId));

  void logApiWrite(apiKey.id, "stage_task", stageTaskId, "update");
  return { ok: true, data: { id: stageTaskId } };
}

export async function deleteStageTaskForApiKey(
  apiKey: AuthenticatedApiKey,
  stageTaskId: string
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;

  await db.delete(stageTasks).where(eq(stageTasks.id, stageTaskId));
  void logApiWrite(apiKey.id, "stage_task", stageTaskId, "delete");
  return { ok: true, data: { id: stageTaskId } };
}

// ---------- Campos customizados ----------

const CUSTOM_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export async function listCustomFieldsForApiKey(
  apiKey: AuthenticatedApiKey,
  entity?: "deal" | "contact"
): Promise<ApiResult<(typeof customFieldDefinitions.$inferSelect)[]>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const rows = entity
    ? await db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.entity, entity)).orderBy(asc(customFieldDefinitions.order))
    : await db.select().from(customFieldDefinitions).orderBy(asc(customFieldDefinitions.order));
  return { ok: true, data: rows };
}

export async function createCustomFieldForApiKey(
  apiKey: AuthenticatedApiKey,
  params: {
    entity: "deal" | "contact";
    key: string;
    label: string;
    type: "texto" | "numero" | "select" | "data";
    options?: { value: string; label: string }[] | null;
  }
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  if (!params.label.trim()) return { ok: false, status: 400, error: "label é obrigatório." };
  const normalizedKey = params.key.trim();
  if (!CUSTOM_FIELD_KEY_PATTERN.test(normalizedKey)) {
    return { ok: false, status: 400, error: "key inválida — use letras minúsculas, números e underscore, começando com letra." };
  }
  if (params.type === "select" && (!params.options || params.options.length === 0)) {
    return { ok: false, status: 400, error: "Campo do tipo select precisa de pelo menos uma opção." };
  }

  const rowsForEntity = await db
    .select({ key: customFieldDefinitions.key, order: customFieldDefinitions.order })
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.entity, params.entity));
  if (rowsForEntity.some((r) => r.key === normalizedKey)) {
    return { ok: false, status: 400, error: "Já existe um campo com essa chave nesta entidade." };
  }
  const nextOrder = rowsForEntity.length > 0 ? Math.max(...rowsForEntity.map((r) => r.order)) + 1 : 0;

  const [created] = await db
    .insert(customFieldDefinitions)
    .values({
      entity: params.entity,
      key: normalizedKey,
      label: params.label.trim(),
      type: params.type,
      options: params.type === "select" ? params.options : null,
      order: nextOrder,
    })
    .returning({ id: customFieldDefinitions.id });

  void logApiWrite(apiKey.id, "custom_field", created.id, "create");
  return { ok: true, data: { id: created.id } };
}

export async function updateCustomFieldForApiKey(
  apiKey: AuthenticatedApiKey,
  fieldId: string,
  params: { label: string; options?: { value: string; label: string }[] | null }
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  if (!params.label.trim()) return { ok: false, status: 400, error: "label é obrigatório." };

  const [field] = await db.select({ type: customFieldDefinitions.type }).from(customFieldDefinitions).where(eq(customFieldDefinitions.id, fieldId)).limit(1);
  if (!field) return { ok: false, status: 404, error: "Campo não encontrado." };
  if (field.type === "select" && (!params.options || params.options.length === 0)) {
    return { ok: false, status: 400, error: "Campo do tipo select precisa de pelo menos uma opção." };
  }

  await db
    .update(customFieldDefinitions)
    .set({ label: params.label.trim(), options: field.type === "select" ? params.options : null })
    .where(eq(customFieldDefinitions.id, fieldId));

  void logApiWrite(apiKey.id, "custom_field", fieldId, "update");
  return { ok: true, data: { id: fieldId } };
}

export async function deleteCustomFieldForApiKey(
  apiKey: AuthenticatedApiKey,
  fieldId: string
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;

  await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.id, fieldId));
  void logApiWrite(apiKey.id, "custom_field", fieldId, "delete");
  return { ok: true, data: { id: fieldId } };
}

// ---------- Tags ----------

async function tagNameConflicts(name: string, excludeId?: string) {
  const rows = await db.select({ id: tags.id, name: tags.name }).from(tags);
  const normalized = name.trim().toLowerCase();
  return rows.some((row) => row.id !== excludeId && row.name.trim().toLowerCase() === normalized);
}

export async function listTagsForApiKey(
  apiKey: AuthenticatedApiKey
): Promise<ApiResult<(typeof tags.$inferSelect)[]>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const rows = await db.select().from(tags);
  return { ok: true, data: rows };
}

export async function createTagForApiKey(
  apiKey: AuthenticatedApiKey,
  params: { name: string; color?: string | null }
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  if (!params.name.trim()) return { ok: false, status: 400, error: "name é obrigatório." };
  if (await tagNameConflicts(params.name)) return { ok: false, status: 400, error: "Já existe uma tag com esse nome." };

  const [created] = await db
    .insert(tags)
    .values({ name: params.name.trim(), color: params.color ?? null })
    .returning({ id: tags.id });

  void logApiWrite(apiKey.id, "tag", created.id, "create");
  return { ok: true, data: { id: created.id } };
}

export async function updateTagForApiKey(
  apiKey: AuthenticatedApiKey,
  tagId: string,
  params: { name: string; color?: string | null }
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  if (!params.name.trim()) return { ok: false, status: 400, error: "name é obrigatório." };
  if (await tagNameConflicts(params.name, tagId)) return { ok: false, status: 400, error: "Já existe uma tag com esse nome." };

  await db.update(tags).set({ name: params.name.trim(), color: params.color ?? null }).where(eq(tags.id, tagId));
  void logApiWrite(apiKey.id, "tag", tagId, "update");
  return { ok: true, data: { id: tagId } };
}

export async function deleteTagForApiKey(
  apiKey: AuthenticatedApiKey,
  tagId: string
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;

  await db.delete(tags).where(eq(tags.id, tagId));
  void logApiWrite(apiKey.id, "tag", tagId, "delete");
  return { ok: true, data: { id: tagId } };
}

// ---------- Templates de mensagem ----------

export async function listMessageTemplatesForApiKey(
  apiKey: AuthenticatedApiKey
): Promise<ApiResult<(typeof messageTemplates.$inferSelect)[]>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const rows = await db.select().from(messageTemplates);
  return { ok: true, data: rows };
}

export async function createMessageTemplateForApiKey(
  apiKey: AuthenticatedApiKey,
  params: { name: string; content: string }
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  if (!params.name.trim()) return { ok: false, status: 400, error: "name é obrigatório." };
  if (!params.content.trim()) return { ok: false, status: 400, error: "content é obrigatório." };

  const [created] = await db
    .insert(messageTemplates)
    .values({ name: params.name.trim(), content: params.content.trim(), variables: extractVariables(params.content) })
    .returning({ id: messageTemplates.id });

  void logApiWrite(apiKey.id, "message_template", created.id, "create");
  return { ok: true, data: { id: created.id } };
}

export async function updateMessageTemplateForApiKey(
  apiKey: AuthenticatedApiKey,
  templateId: string,
  params: { name: string; content: string }
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  if (!params.name.trim()) return { ok: false, status: 400, error: "name é obrigatório." };
  if (!params.content.trim()) return { ok: false, status: 400, error: "content é obrigatório." };

  await db
    .update(messageTemplates)
    .set({ name: params.name.trim(), content: params.content.trim(), variables: extractVariables(params.content) })
    .where(eq(messageTemplates.id, templateId));

  void logApiWrite(apiKey.id, "message_template", templateId, "update");
  return { ok: true, data: { id: templateId } };
}

export async function deleteMessageTemplateForApiKey(
  apiKey: AuthenticatedApiKey,
  templateId: string
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;

  await db.update(stageTasks).set({ messageTemplateId: null }).where(eq(stageTasks.messageTemplateId, templateId));
  await db.delete(messageTemplates).where(eq(messageTemplates.id, templateId));
  void logApiWrite(apiKey.id, "message_template", templateId, "delete");
  return { ok: true, data: { id: templateId } };
}

// ---------- Templates de email ----------

export async function listEmailTemplatesForApiKey(
  apiKey: AuthenticatedApiKey
): Promise<ApiResult<(typeof emailTemplates.$inferSelect)[]>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const rows = await db.select().from(emailTemplates);
  return { ok: true, data: rows };
}

export async function createEmailTemplateForApiKey(
  apiKey: AuthenticatedApiKey,
  params: { name: string; subject: string; content: string }
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  if (!params.name.trim()) return { ok: false, status: 400, error: "name é obrigatório." };
  if (!params.subject.trim()) return { ok: false, status: 400, error: "subject é obrigatório." };
  if (!params.content.trim()) return { ok: false, status: 400, error: "content é obrigatório." };

  const [created] = await db
    .insert(emailTemplates)
    .values({
      name: params.name.trim(),
      subject: params.subject.trim(),
      content: params.content.trim(),
      variables: extractVariables(`${params.subject} ${params.content}`),
    })
    .returning({ id: emailTemplates.id });

  void logApiWrite(apiKey.id, "email_template", created.id, "create");
  return { ok: true, data: { id: created.id } };
}

export async function updateEmailTemplateForApiKey(
  apiKey: AuthenticatedApiKey,
  templateId: string,
  params: { name: string; subject: string; content: string }
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  if (!params.name.trim()) return { ok: false, status: 400, error: "name é obrigatório." };
  if (!params.subject.trim()) return { ok: false, status: 400, error: "subject é obrigatório." };
  if (!params.content.trim()) return { ok: false, status: 400, error: "content é obrigatório." };

  await db
    .update(emailTemplates)
    .set({
      name: params.name.trim(),
      subject: params.subject.trim(),
      content: params.content.trim(),
      variables: extractVariables(`${params.subject} ${params.content}`),
    })
    .where(eq(emailTemplates.id, templateId));

  void logApiWrite(apiKey.id, "email_template", templateId, "update");
  return { ok: true, data: { id: templateId } };
}

export async function deleteEmailTemplateForApiKey(
  apiKey: AuthenticatedApiKey,
  templateId: string
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;

  await db.update(stageTasks).set({ emailTemplateId: null }).where(eq(stageTasks.emailTemplateId, templateId));
  await db.delete(emailTemplates).where(eq(emailTemplates.id, templateId));
  void logApiWrite(apiKey.id, "email_template", templateId, "delete");
  return { ok: true, data: { id: templateId } };
}

// ---------- Automações de tag (tag_automations) ----------
// type aceita "email" aqui (decisão confirmada pra Etapa 28) mesmo a tela de
// configurações ainda rejeitando esse valor — ver docs/dia1-etapas/etapa-28.

type TagAutomationInput = {
  tagId: string;
  title: string;
  type: "mensagem" | "ligacao" | "agendamento" | "generica" | "email";
  trigger: "tag_adicionada" | "dias_apos_tag";
  delayMinutes?: number | null;
  messageTemplateId?: string | null;
  autoSend?: boolean;
  autoSendChannelId?: string | null;
};

function validateTagAutomationInput(input: TagAutomationInput): { error: string } | null {
  if (!input.tagId) return { error: "tagId é obrigatório." };
  if (!input.title.trim()) return { error: "title é obrigatório." };
  if (input.trigger === "dias_apos_tag" && input.delayMinutes == null) {
    return { error: "delayMinutes é obrigatório quando trigger='dias_apos_tag'." };
  }
  if (input.type === "mensagem" && !input.messageTemplateId) {
    return { error: "messageTemplateId é obrigatório para type='mensagem'." };
  }
  if (input.type === "mensagem" && input.autoSend && !input.autoSendChannelId) {
    return { error: "autoSendChannelId é obrigatório quando autoSend=true." };
  }
  return null;
}

export async function listTagAutomationsForApiKey(
  apiKey: AuthenticatedApiKey
): Promise<ApiResult<(typeof tagAutomations.$inferSelect)[]>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const rows = await db.select().from(tagAutomations);
  return { ok: true, data: rows };
}

export async function createTagAutomationForApiKey(
  apiKey: AuthenticatedApiKey,
  params: TagAutomationInput
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const invalid = validateTagAutomationInput(params);
  if (invalid) return { ok: false, status: 400, error: invalid.error };

  const [created] = await db
    .insert(tagAutomations)
    .values({
      tagId: params.tagId,
      title: params.title.trim(),
      type: params.type,
      trigger: params.trigger,
      delayMinutes: params.trigger === "dias_apos_tag" ? (params.delayMinutes ?? null) : null,
      messageTemplateId: params.type === "mensagem" ? (params.messageTemplateId ?? null) : null,
      autoSend: params.type === "mensagem" ? (params.autoSend ?? false) : false,
      autoSendChannelId: params.type === "mensagem" && params.autoSend ? (params.autoSendChannelId ?? null) : null,
    })
    .returning({ id: tagAutomations.id });

  void logApiWrite(apiKey.id, "tag_automation", created.id, "create");
  return { ok: true, data: { id: created.id } };
}

export async function updateTagAutomationForApiKey(
  apiKey: AuthenticatedApiKey,
  automationId: string,
  params: TagAutomationInput
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const invalid = validateTagAutomationInput(params);
  if (invalid) return { ok: false, status: 400, error: invalid.error };

  await db
    .update(tagAutomations)
    .set({
      tagId: params.tagId,
      title: params.title.trim(),
      type: params.type,
      trigger: params.trigger,
      delayMinutes: params.trigger === "dias_apos_tag" ? (params.delayMinutes ?? null) : null,
      messageTemplateId: params.type === "mensagem" ? (params.messageTemplateId ?? null) : null,
      autoSend: params.type === "mensagem" ? (params.autoSend ?? false) : false,
      autoSendChannelId: params.type === "mensagem" && params.autoSend ? (params.autoSendChannelId ?? null) : null,
    })
    .where(eq(tagAutomations.id, automationId));

  void logApiWrite(apiKey.id, "tag_automation", automationId, "update");
  return { ok: true, data: { id: automationId } };
}

export async function deleteTagAutomationForApiKey(
  apiKey: AuthenticatedApiKey,
  automationId: string
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;

  await db.delete(tagAutomations).where(eq(tagAutomations.id, automationId));
  void logApiWrite(apiKey.id, "tag_automation", automationId, "delete");
  return { ok: true, data: { id: automationId } };
}

// ---------- Sequências de automação ----------

type SequenceStepInput = {
  delayMinutes: number;
  type: "mensagem" | "tarefa_generica" | "tag" | "mudar_etapa";
  title?: string | null;
  messageTemplateId?: string | null;
  autoSend?: boolean;
  autoSendChannelId?: string | null;
  addTagId?: string | null;
  moveToStageId?: string | null;
};

type SequenceConditionInput = { field: string; operator: "eq" | "gt" | "lt" | "contains"; value: string } | null;

type SequenceInput = {
  name: string;
  active?: boolean;
  triggerType: "etapa" | "tag" | "sem_resposta";
  triggerStageId?: string | null;
  triggerTagId?: string | null;
  noResponseDays?: number | null;
  conditions?: SequenceConditionInput;
  steps: SequenceStepInput[];
};

function validateSequenceInput(input: SequenceInput): { error: string } | null {
  if (!input.name.trim()) return { error: "name é obrigatório." };
  if (input.triggerType === "etapa" && !input.triggerStageId) return { error: "triggerStageId é obrigatório para triggerType='etapa'." };
  if (input.triggerType === "tag" && !input.triggerTagId) return { error: "triggerTagId é obrigatório para triggerType='tag'." };
  if (input.triggerType === "sem_resposta" && (!input.noResponseDays || input.noResponseDays <= 0)) {
    return { error: "noResponseDays (>0) é obrigatório para triggerType='sem_resposta'." };
  }
  if (!input.steps || input.steps.length === 0) return { error: "Informe ao menos um passo em steps." };
  for (const step of input.steps) {
    if (step.type === "mensagem" && !step.messageTemplateId) return { error: "Todo passo type='mensagem' precisa de messageTemplateId." };
    if (step.type === "tarefa_generica" && !step.title?.trim()) return { error: "Todo passo type='tarefa_generica' precisa de title." };
    if (step.type === "tag" && !step.addTagId) return { error: "Todo passo type='tag' precisa de addTagId." };
    if (step.type === "mudar_etapa" && !step.moveToStageId) return { error: "Todo passo type='mudar_etapa' precisa de moveToStageId." };
  }
  return null;
}

export async function listAutomationSequencesForApiKey(
  apiKey: AuthenticatedApiKey
): Promise<ApiResult<(typeof automationSequences.$inferSelect)[]>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const rows = await db.select().from(automationSequences);
  return { ok: true, data: rows };
}

export async function getAutomationSequenceForApiKey(
  apiKey: AuthenticatedApiKey,
  sequenceId: string
): Promise<ApiResult<{ sequence: typeof automationSequences.$inferSelect; steps: (typeof automationSequenceSteps.$inferSelect)[] }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;

  const [sequence] = await db.select().from(automationSequences).where(eq(automationSequences.id, sequenceId)).limit(1);
  if (!sequence) return { ok: false, status: 404, error: "Sequência não encontrada." };
  const steps = await db
    .select()
    .from(automationSequenceSteps)
    .where(eq(automationSequenceSteps.sequenceId, sequenceId))
    .orderBy(asc(automationSequenceSteps.order));
  return { ok: true, data: { sequence, steps } };
}

export async function createAutomationSequenceForApiKey(
  apiKey: AuthenticatedApiKey,
  params: SequenceInput
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const invalid = validateSequenceInput(params);
  if (invalid) return { ok: false, status: 400, error: invalid.error };

  const [created] = await db
    .insert(automationSequences)
    .values({
      name: params.name.trim(),
      active: params.active ?? true,
      triggerType: params.triggerType,
      triggerStageId: params.triggerType === "etapa" ? (params.triggerStageId ?? null) : null,
      triggerTagId: params.triggerType === "tag" ? (params.triggerTagId ?? null) : null,
      noResponseDays: params.triggerType === "sem_resposta" ? (params.noResponseDays ?? null) : null,
      conditions: params.conditions ?? null,
    })
    .returning({ id: automationSequences.id });

  await db.insert(automationSequenceSteps).values(
    params.steps.map((step, index) => ({
      sequenceId: created.id,
      order: index,
      delayMinutes: step.delayMinutes,
      type: step.type,
      title: step.title ?? null,
      messageTemplateId: step.messageTemplateId ?? null,
      autoSend: step.autoSend ?? false,
      autoSendChannelId: step.autoSendChannelId ?? null,
      addTagId: step.addTagId ?? null,
      moveToStageId: step.moveToStageId ?? null,
    }))
  );

  void logApiWrite(apiKey.id, "automation_sequence", created.id, "create");
  return { ok: true, data: { id: created.id } };
}

export async function updateAutomationSequenceForApiKey(
  apiKey: AuthenticatedApiKey,
  sequenceId: string,
  params: SequenceInput
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const invalid = validateSequenceInput(params);
  if (invalid) return { ok: false, status: 400, error: invalid.error };

  await db
    .update(automationSequences)
    .set({
      name: params.name.trim(),
      active: params.active ?? true,
      triggerType: params.triggerType,
      triggerStageId: params.triggerType === "etapa" ? (params.triggerStageId ?? null) : null,
      triggerTagId: params.triggerType === "tag" ? (params.triggerTagId ?? null) : null,
      noResponseDays: params.triggerType === "sem_resposta" ? (params.noResponseDays ?? null) : null,
      conditions: params.conditions ?? null,
    })
    .where(eq(automationSequences.id, sequenceId));

  // Substitui todos os passos de uma vez (delete + insert), mesmo padrão já
  // usado em updateSequenceAction (configuracoes/sequencias/actions.ts).
  const insertValues = params.steps.map((step, index) => ({
    sequenceId,
    order: index,
    delayMinutes: step.delayMinutes,
    type: step.type,
    title: step.title ?? null,
    messageTemplateId: step.messageTemplateId ?? null,
    autoSend: step.autoSend ?? false,
    autoSendChannelId: step.autoSendChannelId ?? null,
    addTagId: step.addTagId ?? null,
    moveToStageId: step.moveToStageId ?? null,
  }));
  await db.batch([
    db.delete(automationSequenceSteps).where(eq(automationSequenceSteps.sequenceId, sequenceId)),
    db.insert(automationSequenceSteps).values(insertValues),
  ]);

  void logApiWrite(apiKey.id, "automation_sequence", sequenceId, "update");
  return { ok: true, data: { id: sequenceId } };
}

export async function deleteAutomationSequenceForApiKey(
  apiKey: AuthenticatedApiKey,
  sequenceId: string
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;

  await db.delete(automationSequences).where(eq(automationSequences.id, sequenceId));
  void logApiWrite(apiKey.id, "automation_sequence", sequenceId, "delete");
  return { ok: true, data: { id: sequenceId } };
}

// ---------- Webhooks (webhook_configs, direction-discriminado) ----------

type WebhookInput = {
  direction: "entrada" | "saida";
  name: string;
  // entrada
  defaultPipelineId?: string | null;
  defaultStageId?: string | null;
  // saida
  targetUrl?: string | null;
  events?: string[];
  pipelineId?: string | null;
  stageId?: string | null;
};

function validateWebhookInput(input: WebhookInput): { error: string } | null {
  if (!input.name.trim()) return { error: "name é obrigatório." };
  if (input.direction === "entrada") {
    if (!input.defaultPipelineId) return { error: "defaultPipelineId é obrigatório para direction='entrada'." };
    if (!input.defaultStageId) return { error: "defaultStageId é obrigatório para direction='entrada'." };
  } else {
    if (!input.targetUrl?.trim()) return { error: "targetUrl é obrigatório para direction='saida'." };
    try {
      new URL(input.targetUrl);
    } catch {
      return { error: "targetUrl inválida." };
    }
    if (!input.events || input.events.length === 0) return { error: "Selecione ao menos um evento em events." };
  }
  return null;
}

export async function listWebhooksForApiKey(
  apiKey: AuthenticatedApiKey
): Promise<ApiResult<Omit<typeof webhookConfigs.$inferSelect, "secretToken">[]>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const rows = await db.select().from(webhookConfigs);
  return { ok: true, data: rows.map(({ secretToken: _secretToken, ...rest }) => rest) };
}

export async function createWebhookForApiKey(
  apiKey: AuthenticatedApiKey,
  params: WebhookInput
): Promise<ApiResult<{ id: string; secretToken?: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const invalid = validateWebhookInput(params);
  if (invalid) return { ok: false, status: 400, error: invalid.error };

  const secretToken = params.direction === "entrada" ? randomBytes(24).toString("hex") : undefined;

  const [created] = await db
    .insert(webhookConfigs)
    .values({
      name: params.name.trim(),
      direction: params.direction,
      sourcePlatform: params.direction === "entrada" ? params.name.trim() : null,
      secretToken: secretToken ?? null,
      defaultPipelineId: params.direction === "entrada" ? params.defaultPipelineId : null,
      defaultStageId: params.direction === "entrada" ? params.defaultStageId : null,
      targetUrl: params.direction === "saida" ? params.targetUrl?.trim() : null,
      events: params.direction === "saida" ? params.events : null,
      pipelineId: params.direction === "saida" ? (params.pipelineId ?? null) : null,
      stageId: params.direction === "saida" ? (params.stageId ?? null) : null,
      fieldMapping: {},
    })
    .returning({ id: webhookConfigs.id });

  void logApiWrite(apiKey.id, "webhook", created.id, "create");
  return { ok: true, data: { id: created.id, secretToken } };
}

export async function updateWebhookForApiKey(
  apiKey: AuthenticatedApiKey,
  webhookId: string,
  params: WebhookInput
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;
  const invalid = validateWebhookInput(params);
  if (invalid) return { ok: false, status: 400, error: invalid.error };

  await db
    .update(webhookConfigs)
    .set({
      name: params.name.trim(),
      defaultPipelineId: params.direction === "entrada" ? params.defaultPipelineId : null,
      defaultStageId: params.direction === "entrada" ? params.defaultStageId : null,
      targetUrl: params.direction === "saida" ? params.targetUrl?.trim() : null,
      events: params.direction === "saida" ? params.events : null,
      pipelineId: params.direction === "saida" ? (params.pipelineId ?? null) : null,
      stageId: params.direction === "saida" ? (params.stageId ?? null) : null,
    })
    .where(eq(webhookConfigs.id, webhookId));

  void logApiWrite(apiKey.id, "webhook", webhookId, "update");
  return { ok: true, data: { id: webhookId } };
}

export async function deleteWebhookForApiKey(
  apiKey: AuthenticatedApiKey,
  webhookId: string
): Promise<ApiResult<{ id: string }>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;

  await db.delete(webhookConfigs).where(eq(webhookConfigs.id, webhookId));
  void logApiWrite(apiKey.id, "webhook", webhookId, "delete");
  return { ok: true, data: { id: webhookId } };
}

// ---------- Canais (somente leitura — nunca expõe credencial) ----------

export type ChannelSummary = {
  id: string;
  label: string;
  type: "whatsapp" | "instagram";
  status: string;
  isDefault: boolean;
};

export async function listChannelsForApiKey(
  apiKey: AuthenticatedApiKey
): Promise<ApiResult<ChannelSummary[]>> {
  const forbidden = requireAdminScope(apiKey);
  if (forbidden) return forbidden;

  const [whatsapp, instagram] = await Promise.all([
    db.select({ id: whatsappChannels.id, label: whatsappChannels.label, status: whatsappChannels.status, isDefault: whatsappChannels.isDefault }).from(whatsappChannels),
    db.select({ id: instagramChannels.id, label: instagramChannels.label, status: instagramChannels.status, isDefault: instagramChannels.isDefault }).from(instagramChannels),
  ]);

  return {
    ok: true,
    data: [
      ...whatsapp.map((c) => ({ ...c, type: "whatsapp" as const })),
      ...instagram.map((c) => ({ ...c, type: "instagram" as const })),
    ],
  };
}

