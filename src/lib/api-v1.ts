import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  contacts,
  customFieldDefinitions,
  deals,
  dealTags,
  lossReasons,
  pipelines,
  stages,
  tags,
  tasks,
  users,
} from "@/db/schema";
import { logApiWrite } from "@/lib/api-audit";
import type { AuthenticatedApiKey } from "@/lib/api-keys";
import { cancelActiveSequenceRuns, fireStatusSequenceTriggers } from "@/lib/automation-sequences";
import { getAllowedChannelIds, userHasChannelAccess } from "@/lib/channel-access";
import { findDuplicateContact } from "@/lib/contact-merge";
import { getThread, type ThreadMessage } from "@/lib/conversations";
import { logDealActivity } from "@/lib/deal-activity-log";
import { moveDealStage } from "@/lib/deal-mutations";
import { sendDealEmail } from "@/lib/emails";
import {
  resolveDistributedOwner,
  syncContactOwnerFromDeal,
} from "@/lib/owner-distribution";
import { sendTextMessage } from "@/lib/send-message";
import { fireTagAddedAutomations } from "@/lib/task-automation";
import { canViewOwnedRecord, ownerVisibilityFilter } from "@/lib/visibility";
import { dispatchOutboundWebhooks } from "@/lib/webhook-outbound";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 403 | 404; error: string };

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function clampLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

// ---------- Negócios ----------

export type DealListFilters = {
  pipelineId?: string;
  stageId?: string;
  ownerId?: string; // uuid, "me" ou "unassigned"
  status?: "aberto" | "ganho" | "perdido";
  temperature?: "quente" | "morno" | "frio";
  tagId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

const DEAL_LIST_SELECTION = {
  id: deals.id,
  title: deals.title,
  status: deals.status,
  wonAt: deals.wonAt,
  lostAt: deals.lostAt,
  lossReasonId: deals.lossReasonId,
  lossReasonLabel: lossReasons.label,
  temperature: deals.temperature,
  value: deals.value,
  pipelineId: deals.pipelineId,
  pipelineName: pipelines.name,
  stageId: deals.stageId,
  stageName: stages.name,
  ownerId: deals.ownerId,
  ownerName: users.name,
  contactId: deals.contactId,
  contactName: contacts.name,
  contactPhone: contacts.phone,
  createdAt: deals.createdAt,
  updatedAt: deals.updatedAt,
} as const;

// Mesmas dimensões de filtro da tela de negócios (Etapa 8/21, ver
// deal-filters.tsx) — reaproveitadas aqui pro critério de aceite "filtros
// equivalentes aos já usados nas telas". ownerVisibilityFilter garante que
// uma chave criada por um atendente restrito só lista o que esse atendente
// veria no CRM.
export async function listDeals(
  actingUser: AuthenticatedApiKey["actingUser"],
  filters: DealListFilters
) {
  const conditions = [ownerVisibilityFilter(deals.ownerId, actingUser)];
  if (filters.pipelineId) conditions.push(eq(deals.pipelineId, filters.pipelineId));
  if (filters.stageId) conditions.push(eq(deals.stageId, filters.stageId));
  if (filters.status) conditions.push(eq(deals.status, filters.status));
  if (filters.temperature) conditions.push(eq(deals.temperature, filters.temperature));

  if (filters.ownerId === "me") conditions.push(eq(deals.ownerId, actingUser.id));
  else if (filters.ownerId === "unassigned") conditions.push(isNull(deals.ownerId));
  else if (filters.ownerId) conditions.push(eq(deals.ownerId, filters.ownerId));

  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(ilike(deals.title, term), ilike(contacts.name, term))!);
  }

  if (filters.tagId) {
    const tagged = await db
      .select({ dealId: dealTags.dealId })
      .from(dealTags)
      .where(eq(dealTags.tagId, filters.tagId));
    const ids = tagged.map((r) => r.dealId);
    if (ids.length === 0) return [];
    conditions.push(inArray(deals.id, ids));
  }

  return db
    .select(DEAL_LIST_SELECTION)
    .from(deals)
    .innerJoin(contacts, eq(deals.contactId, contacts.id))
    .innerJoin(pipelines, eq(deals.pipelineId, pipelines.id))
    .innerJoin(stages, eq(deals.stageId, stages.id))
    .leftJoin(users, eq(deals.ownerId, users.id))
    .leftJoin(lossReasons, eq(deals.lossReasonId, lossReasons.id))
    .where(and(...conditions))
    .orderBy(desc(deals.updatedAt))
    .limit(clampLimit(filters.limit))
    .offset(filters.offset ?? 0);
}

export async function getDeal(actingUser: AuthenticatedApiKey["actingUser"], dealId: string) {
  const [deal] = await db
    .select(DEAL_LIST_SELECTION)
    .from(deals)
    .innerJoin(contacts, eq(deals.contactId, contacts.id))
    .innerJoin(pipelines, eq(deals.pipelineId, pipelines.id))
    .innerJoin(stages, eq(deals.stageId, stages.id))
    .leftJoin(users, eq(deals.ownerId, users.id))
    .leftJoin(lossReasons, eq(deals.lossReasonId, lossReasons.id))
    .where(eq(deals.id, dealId))
    .limit(1);

  if (!deal || !canViewOwnedRecord(deal.ownerId, actingUser)) return null;
  return deal;
}

export async function moveDealStageForApiKey(
  apiKey: AuthenticatedApiKey,
  dealId: string,
  stageId: string
): Promise<ApiResult<{ dealId: string; stageId: string }>> {
  const [deal] = await db.select({ ownerId: deals.ownerId }).from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!deal || !canViewOwnedRecord(deal.ownerId, apiKey.actingUser)) {
    return { ok: false, status: 404, error: "Negócio não encontrado." };
  }

  const [stage] = await db.select({ id: stages.id }).from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) return { ok: false, status: 400, error: "Etapa inválida." };

  const result = await moveDealStage(dealId, stageId, {
    userId: apiKey.actingUser.id,
    source: "api",
  });
  if (!result.ok) return { ok: false, status: 404, error: "Negócio não encontrado." };
  void logApiWrite(apiKey.id, "deal", dealId, "move_stage");
  return { ok: true, data: { dealId, stageId } };
}

// ---------- Negócios: criar/editar (Etapa 28) ----------

async function filterCustomFields(
  entity: "deal" | "contact",
  customFields: Record<string, unknown> | undefined
): Promise<Record<string, string>> {
  if (!customFields) return {};
  const defs = await db
    .select({ key: customFieldDefinitions.key })
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.entity, entity));
  const allowedKeys = new Set(defs.map((d) => d.key));
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(customFields)) {
    if (allowedKeys.has(key) && value != null && String(value).trim()) {
      result[key] = String(value).trim();
    }
  }
  return result;
}

export type CreateDealParams = {
  contactId: string;
  pipelineId: string;
  stageId: string;
  title?: string;
  ownerId?: string | null;
  value?: string | null;
  customFields?: Record<string, unknown>;
  tagIds?: string[];
};

export async function createDealForApiKey(
  apiKey: AuthenticatedApiKey,
  params: CreateDealParams
): Promise<ApiResult<{ id: string }>> {
  const [stage] = await db
    .select({ id: stages.id, pipelineId: stages.pipelineId })
    .from(stages)
    .where(eq(stages.id, params.stageId))
    .limit(1);
  if (!stage || stage.pipelineId !== params.pipelineId) {
    return { ok: false, status: 400, error: "Etapa inválida para a pipeline informada." };
  }

  const [contact] = await db
    .select({ name: contacts.name, ownerId: contacts.ownerId })
    .from(contacts)
    .where(eq(contacts.id, params.contactId))
    .limit(1);
  if (!contact || !canViewOwnedRecord(contact.ownerId, apiKey.actingUser)) {
    return { ok: false, status: 404, error: "Contato não encontrado." };
  }

  const title = params.title?.trim() || contact.name;
  const customFields = await filterCustomFields("deal", params.customFields);
  const ownerId =
    params.ownerId !== undefined ? params.ownerId : await resolveDistributedOwner(params.pipelineId);

  const [created] = await db
    .insert(deals)
    .values({
      contactId: params.contactId,
      pipelineId: params.pipelineId,
      stageId: params.stageId,
      title,
      ownerId,
      value: params.value ?? null,
      customFields,
    })
    .returning({ id: deals.id });

  if (ownerId) await syncContactOwnerFromDeal(params.contactId, ownerId);
  await logDealActivity({ dealId: created.id, userId: apiKey.actingUser.id, source: "api", action: "criado" });

  const tagIds = Array.from(new Set(params.tagIds ?? []));
  if (tagIds.length > 0) {
    await db.insert(dealTags).values(tagIds.map((tagId) => ({ dealId: created.id, tagId })));
    const tagRows = await db.select({ id: tags.id, name: tags.name }).from(tags).where(inArray(tags.id, tagIds));
    for (const tag of tagRows) {
      await logDealActivity({
        dealId: created.id,
        userId: apiKey.actingUser.id,
        source: "api",
        action: "tag_adicionada",
        newValue: tag.name,
      });
      void dispatchOutboundWebhooks("tag_adicionada", created.id, tag.id);
    }
    await fireTagAddedAutomations(created.id, tagIds);
  }

  void dispatchOutboundWebhooks("negocio_criado", created.id);
  void logApiWrite(apiKey.id, "deal", created.id, "create");
  return { ok: true, data: { id: created.id } };
}

export type UpdateDealParams = {
  title?: string;
  ownerId?: string | null;
  value?: string | null;
  stageId?: string;
  customFields?: Record<string, unknown>;
  // Status é campo próprio do negócio (não deriva da etapa) — ver
  // setDealStatusAction/setDealLostAction em src/app/negocios/actions.ts,
  // cuja lógica é espelhada aqui pra API/MCP. "perdido" exige lossReasonId
  // válido pra pipeline do negócio (mesma regra da tela de negócios).
  status?: "aberto" | "ganho" | "perdido";
  lossReasonId?: string;
};

export async function updateDealForApiKey(
  apiKey: AuthenticatedApiKey,
  dealId: string,
  params: UpdateDealParams
): Promise<ApiResult<{ id: string }>> {
  const [current] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!current || !canViewOwnedRecord(current.ownerId, apiKey.actingUser)) {
    return { ok: false, status: 404, error: "Negócio não encontrado." };
  }

  if (params.status !== undefined && !["aberto", "ganho", "perdido"].includes(params.status)) {
    return { ok: false, status: 400, error: "status inválido." };
  }

  let lossReason: { id: string; label: string } | undefined;
  if (params.status === "perdido") {
    if (!params.lossReasonId) {
      return { ok: false, status: 400, error: "lossReasonId é obrigatório pra marcar como perdido." };
    }
    const [reason] = await db
      .select({ id: lossReasons.id, label: lossReasons.label })
      .from(lossReasons)
      .where(and(eq(lossReasons.id, params.lossReasonId), eq(lossReasons.pipelineId, current.pipelineId)))
      .limit(1);
    if (!reason) return { ok: false, status: 400, error: "lossReasonId inválido pra esta pipeline." };
    lossReason = reason;
  }

  const customFields =
    params.customFields !== undefined
      ? { ...(current.customFields as Record<string, string>), ...(await filterCustomFields("deal", params.customFields)) }
      : undefined;

  const hasBasicFieldChange =
    params.title !== undefined ||
    params.ownerId !== undefined ||
    params.value !== undefined ||
    customFields !== undefined;

  await db
    .update(deals)
    .set({
      ...(params.title !== undefined ? { title: params.title.trim() || current.title } : {}),
      ...(params.ownerId !== undefined ? { ownerId: params.ownerId } : {}),
      ...(params.value !== undefined ? { value: params.value } : {}),
      ...(customFields !== undefined ? { customFields } : {}),
      ...(params.status !== undefined
        ? {
            status: params.status,
            wonAt: params.status === "ganho" ? new Date() : null,
            lostAt: params.status === "perdido" ? new Date() : null,
            lossReasonId: params.status === "perdido" ? params.lossReasonId : null,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(deals.id, dealId));

  if (params.ownerId !== undefined) {
    await syncContactOwnerFromDeal(current.contactId, params.ownerId);
  }
  if (hasBasicFieldChange) {
    await logDealActivity({
      dealId,
      userId: apiKey.actingUser.id,
      source: "api",
      action: "editado",
    });
  }

  if (params.status !== undefined && params.status !== current.status) {
    await logDealActivity({
      dealId,
      userId: apiKey.actingUser.id,
      source: "api",
      action: params.status === "ganho" ? "ganho" : params.status === "perdido" ? "perdido" : "editado",
      fieldName: "Status",
      oldValue: current.status,
      newValue: params.status === "perdido" && lossReason ? `Perdido — ${lossReason.label}` : params.status,
    });
    if (params.status === "ganho" || params.status === "perdido") {
      await cancelActiveSequenceRuns(dealId);
      await fireStatusSequenceTriggers(dealId, params.status);
      void dispatchOutboundWebhooks(params.status === "ganho" ? "negocio_ganho" : "negocio_perdido", dealId);
    }
  }

  if (params.stageId && params.stageId !== current.stageId) {
    const [stage] = await db.select({ id: stages.id }).from(stages).where(eq(stages.id, params.stageId)).limit(1);
    if (!stage) return { ok: false, status: 400, error: "Etapa inválida." };
    await moveDealStage(dealId, params.stageId, { userId: apiKey.actingUser.id, source: "api" });
  }

  void logApiWrite(apiKey.id, "deal", dealId, "update");
  return { ok: true, data: { id: dealId } };
}

export async function addTagToDealForApiKey(
  apiKey: AuthenticatedApiKey,
  dealId: string,
  tagId: string
): Promise<ApiResult<{ ok: true }>> {
  const [deal] = await db.select({ ownerId: deals.ownerId }).from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!deal || !canViewOwnedRecord(deal.ownerId, apiKey.actingUser)) {
    return { ok: false, status: 404, error: "Negócio não encontrado." };
  }
  const [tag] = await db.select({ id: tags.id, name: tags.name }).from(tags).where(eq(tags.id, tagId)).limit(1);
  if (!tag) return { ok: false, status: 400, error: "Tag inválida." };

  const inserted = await db
    .insert(dealTags)
    .values({ dealId, tagId })
    .onConflictDoNothing()
    .returning({ dealId: dealTags.dealId });

  if (inserted.length > 0) {
    await logDealActivity({
      dealId,
      userId: apiKey.actingUser.id,
      source: "api",
      action: "tag_adicionada",
      newValue: tag.name,
    });
    await fireTagAddedAutomations(dealId, [tagId]);
    void dispatchOutboundWebhooks("tag_adicionada", dealId, tagId);
  }

  void logApiWrite(apiKey.id, "deal", dealId, "add_tag");
  return { ok: true, data: { ok: true } };
}

export async function removeTagFromDealForApiKey(
  apiKey: AuthenticatedApiKey,
  dealId: string,
  tagId: string
): Promise<ApiResult<{ ok: true }>> {
  const [deal] = await db.select({ ownerId: deals.ownerId }).from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!deal || !canViewOwnedRecord(deal.ownerId, apiKey.actingUser)) {
    return { ok: false, status: 404, error: "Negócio não encontrado." };
  }
  const [tag] = await db.select({ id: tags.id, name: tags.name }).from(tags).where(eq(tags.id, tagId)).limit(1);

  await db.delete(dealTags).where(and(eq(dealTags.dealId, dealId), eq(dealTags.tagId, tagId)));
  if (tag) {
    await logDealActivity({
      dealId,
      userId: apiKey.actingUser.id,
      source: "api",
      action: "tag_removida",
      oldValue: tag.name,
    });
  }

  void logApiWrite(apiKey.id, "deal", dealId, "remove_tag");
  return { ok: true, data: { ok: true } };
}

export async function sendActivityEmailForApiKey(
  apiKey: AuthenticatedApiKey,
  params: { dealId: string; to: string; subject: string; body: string }
): Promise<ApiResult<{ emailSentId: string }>> {
  const [deal] = await db
    .select({ ownerId: deals.ownerId, contactId: deals.contactId })
    .from(deals)
    .where(eq(deals.id, params.dealId))
    .limit(1);
  if (!deal || !canViewOwnedRecord(deal.ownerId, apiKey.actingUser)) {
    return { ok: false, status: 404, error: "Negócio não encontrado." };
  }
  if (!params.to.trim() || !params.subject.trim() || !params.body.trim()) {
    return { ok: false, status: 400, error: "to, subject e body são obrigatórios." };
  }

  const result = await sendDealEmail({
    dealId: params.dealId,
    contactId: deal.contactId,
    to: params.to.trim(),
    subject: params.subject.trim(),
    body: params.body,
    attachments: [],
    sentByUserId: apiKey.actingUser.id,
  });
  if (!result.ok) return { ok: false, status: 400, error: result.error };

  void logApiWrite(apiKey.id, "deal", params.dealId, "send_email");
  return { ok: true, data: { emailSentId: result.emailSentId } };
}

// ---------- Contatos ----------

export type ContactListFilters = {
  search?: string;
  ownerId?: string;
  limit?: number;
  offset?: number;
};

const CONTACT_SELECTION = {
  id: contacts.id,
  name: contacts.name,
  phone: contacts.phone,
  email: contacts.email,
  ownerId: contacts.ownerId,
  ownerName: users.name,
  createdAt: contacts.createdAt,
} as const;

export async function listContacts(
  actingUser: AuthenticatedApiKey["actingUser"],
  filters: ContactListFilters
) {
  const conditions = [ownerVisibilityFilter(contacts.ownerId, actingUser)];
  if (filters.ownerId) conditions.push(eq(contacts.ownerId, filters.ownerId));
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(ilike(contacts.name, term), ilike(contacts.phone, term))!);
  }

  return db
    .select(CONTACT_SELECTION)
    .from(contacts)
    .leftJoin(users, eq(contacts.ownerId, users.id))
    .where(and(...conditions))
    .orderBy(desc(contacts.createdAt))
    .limit(clampLimit(filters.limit))
    .offset(filters.offset ?? 0);
}

export async function getContact(actingUser: AuthenticatedApiKey["actingUser"], contactId: string) {
  const [contact] = await db
    .select(CONTACT_SELECTION)
    .from(contacts)
    .leftJoin(users, eq(contacts.ownerId, users.id))
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact || !canViewOwnedRecord(contact.ownerId, actingUser)) return null;
  return contact;
}

export type CreateContactParams = {
  name: string;
  phone?: string | null;
  email?: string | null;
  customFields?: Record<string, unknown>;
};

export async function createContactForApiKey(
  apiKey: AuthenticatedApiKey,
  params: CreateContactParams
): Promise<ApiResult<{ id: string }>> {
  if (!params.name.trim()) return { ok: false, status: 400, error: "name é obrigatório." };

  const normalizedPhone = params.phone?.trim() || null;
  const normalizedEmail = params.email?.trim() || null;
  if (!normalizedPhone && !normalizedEmail) {
    return { ok: false, status: 400, error: "Informe phone e/ou email." };
  }

  // Mesma checagem de duplicata (telefone OU email) usada na tela de
  // contatos (ver findDuplicateContact) — API/MCP não pode criar um
  // duplicado que a UI bloquearia.
  const duplicate = await findDuplicateContact(normalizedPhone, normalizedEmail);
  if (duplicate) {
    return { ok: false, status: 400, error: `Já existe um contato com esse ${duplicate.matchedField}.` };
  }

  const customFields = await filterCustomFields("contact", params.customFields);
  const [created] = await db
    .insert(contacts)
    .values({
      name: params.name.trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      customFields,
    })
    .returning({ id: contacts.id });

  void logApiWrite(apiKey.id, "contact", created.id, "create");
  return { ok: true, data: { id: created.id } };
}

export type UpdateContactParams = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  customFields?: Record<string, unknown>;
};

export async function updateContactForApiKey(
  apiKey: AuthenticatedApiKey,
  contactId: string,
  params: UpdateContactParams
): Promise<ApiResult<{ id: string }>> {
  const [current] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!current || !canViewOwnedRecord(current.ownerId, apiKey.actingUser)) {
    return { ok: false, status: 404, error: "Contato não encontrado." };
  }

  const nextPhone = params.phone !== undefined ? params.phone?.trim() || null : current.phone;
  const nextEmail = params.email !== undefined ? params.email?.trim() || null : current.email;
  if (!nextPhone && !nextEmail) {
    return { ok: false, status: 400, error: "Contato precisa ter phone e/ou email." };
  }

  if (params.phone !== undefined || params.email !== undefined) {
    const duplicate = await findDuplicateContact(nextPhone, nextEmail, contactId);
    if (duplicate) {
      return { ok: false, status: 400, error: `Já existe um contato com esse ${duplicate.matchedField}.` };
    }
  }

  const customFields =
    params.customFields !== undefined
      ? { ...(current.customFields as Record<string, string>), ...(await filterCustomFields("contact", params.customFields)) }
      : undefined;

  await db
    .update(contacts)
    .set({
      ...(params.name !== undefined ? { name: params.name.trim() || current.name } : {}),
      ...(params.phone !== undefined ? { phone: nextPhone } : {}),
      ...(params.email !== undefined ? { email: nextEmail } : {}),
      ...(customFields !== undefined ? { customFields } : {}),
    })
    .where(eq(contacts.id, contactId));

  void logApiWrite(apiKey.id, "contact", contactId, "update");
  return { ok: true, data: { id: contactId } };
}

// ---------- Mensagens (histórico de conversa de um negócio) ----------

export async function getDealConversation(
  actingUser: AuthenticatedApiKey["actingUser"],
  dealId: string
): Promise<ApiResult<ThreadMessage[]>> {
  const [deal] = await db
    .select({ ownerId: deals.ownerId, contactId: deals.contactId })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (!deal || !canViewOwnedRecord(deal.ownerId, actingUser)) {
    return { ok: false, status: 404, error: "Negócio não encontrado." };
  }

  const allowedChannelIds = await getAllowedChannelIds(actingUser.id, actingUser.role);
  // undefined = sem filtro de canal — API pública continua devolvendo o
  // histórico mesclado (consumidor externo decide o que fazer com
  // channelId/channelLabel por mensagem).
  const thread = await getThread(deal.contactId, undefined, allowedChannelIds);
  return { ok: true, data: thread };
}

export async function sendMessageForApiKey(
  apiKey: AuthenticatedApiKey,
  params: { channelId: string; contactId: string; message: string }
): Promise<ApiResult<{ messageId: string }>> {
  const [contact] = await db
    .select({ ownerId: contacts.ownerId })
    .from(contacts)
    .where(eq(contacts.id, params.contactId))
    .limit(1);
  if (!contact || !canViewOwnedRecord(contact.ownerId, apiKey.actingUser)) {
    return { ok: false, status: 404, error: "Contato não encontrado." };
  }

  const allowed = await userHasChannelAccess(
    apiKey.actingUser.id,
    apiKey.actingUser.role,
    params.channelId
  );
  if (!allowed) return { ok: false, status: 403, error: "Sem acesso a este canal." };

  const result = await sendTextMessage(params);
  if (!result.ok) {
    const status = result.error.includes("não encontrado") ? 404 : 400;
    return { ok: false, status, error: result.error };
  }
  void logApiWrite(apiKey.id, "message", result.message.id, "send");
  return { ok: true, data: { messageId: result.message.id } };
}

// ---------- Tarefas ----------

export type TaskListFilters = {
  dealId?: string;
  status?: "pendente" | "concluida";
  limit?: number;
  offset?: number;
};

const TASK_SELECTION = {
  id: tasks.id,
  dealId: tasks.dealId,
  title: tasks.title,
  type: tasks.type,
  status: tasks.status,
  dueAt: tasks.dueAt,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
} as const;

export async function listTasks(
  actingUser: AuthenticatedApiKey["actingUser"],
  filters: TaskListFilters
) {
  const conditions = [ownerVisibilityFilter(deals.ownerId, actingUser)];
  if (filters.dealId) conditions.push(eq(tasks.dealId, filters.dealId));
  if (filters.status) conditions.push(eq(tasks.status, filters.status));

  return db
    .select(TASK_SELECTION)
    .from(tasks)
    .innerJoin(deals, eq(tasks.dealId, deals.id))
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt))
    .limit(clampLimit(filters.limit))
    .offset(filters.offset ?? 0);
}

export async function createTaskForApiKey(
  apiKey: AuthenticatedApiKey,
  params: {
    dealId: string;
    title: string;
    type: "mensagem" | "ligacao" | "agendamento" | "generica" | "email";
    dueAt: string | null;
  }
): Promise<ApiResult<{ id: string }>> {
  if (!params.title.trim()) return { ok: false, status: 400, error: "title é obrigatório." };

  const [deal] = await db.select({ ownerId: deals.ownerId }).from(deals).where(eq(deals.id, params.dealId)).limit(1);
  if (!deal || !canViewOwnedRecord(deal.ownerId, apiKey.actingUser)) {
    return { ok: false, status: 404, error: "Negócio não encontrado." };
  }

  const [created] = await db
    .insert(tasks)
    .values({
      dealId: params.dealId,
      title: params.title.trim(),
      type: params.type,
      status: "pendente",
      dueAt: params.dueAt ? new Date(params.dueAt) : null,
    })
    .returning({ id: tasks.id });

  void logApiWrite(apiKey.id, "task", created.id, "create");
  return { ok: true, data: { id: created.id } };
}

export async function completeTaskForApiKey(
  apiKey: AuthenticatedApiKey,
  taskId: string
): Promise<ApiResult<{ id: string }>> {
  const [row] = await db
    .select({ taskId: tasks.id, ownerId: deals.ownerId })
    .from(tasks)
    .innerJoin(deals, eq(tasks.dealId, deals.id))
    .where(eq(tasks.id, taskId))
    .limit(1);
  if (!row || !canViewOwnedRecord(row.ownerId, apiKey.actingUser)) {
    return { ok: false, status: 404, error: "Tarefa não encontrada." };
  }

  await db
    .update(tasks)
    .set({ status: "concluida", completedAt: new Date(), completedBy: apiKey.actingUser.id })
    .where(eq(tasks.id, taskId));

  void logApiWrite(apiKey.id, "task", taskId, "complete");
  return { ok: true, data: { id: taskId } };
}
