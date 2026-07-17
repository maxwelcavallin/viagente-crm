import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { contacts, deals, pipelines, stages, dealTags, tasks, users } from "@/db/schema";
import type { AuthenticatedApiKey } from "@/lib/api-keys";
import { hasWriteScope } from "@/lib/api-keys";
import { getAllowedChannelIds, userHasChannelAccess } from "@/lib/channel-access";
import { getThread, type ThreadMessage } from "@/lib/conversations";
import { moveDealStage } from "@/lib/deal-mutations";
import { sendTextMessage } from "@/lib/send-message";
import { canViewOwnedRecord, ownerVisibilityFilter } from "@/lib/visibility";

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
  if (!hasWriteScope(apiKey)) {
    return { ok: false, status: 403, error: "Chave sem escopo de escrita." };
  }

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
  return { ok: true, data: { dealId, stageId } };
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
  const thread = await getThread(deal.contactId, allowedChannelIds);
  return { ok: true, data: thread };
}

export async function sendMessageForApiKey(
  apiKey: AuthenticatedApiKey,
  params: { channelId: string; contactId: string; message: string }
): Promise<ApiResult<{ messageId: string }>> {
  if (!hasWriteScope(apiKey)) {
    return { ok: false, status: 403, error: "Chave sem escopo de escrita." };
  }

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
    type: "mensagem" | "ligacao" | "agendamento" | "generica";
    dueAt: string | null;
  }
): Promise<ApiResult<{ id: string }>> {
  if (!hasWriteScope(apiKey)) {
    return { ok: false, status: 403, error: "Chave sem escopo de escrita." };
  }
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

  return { ok: true, data: { id: created.id } };
}

export async function completeTaskForApiKey(
  apiKey: AuthenticatedApiKey,
  taskId: string
): Promise<ApiResult<{ id: string }>> {
  if (!hasWriteScope(apiKey)) {
    return { ok: false, status: 403, error: "Chave sem escopo de escrita." };
  }

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

  return { ok: true, data: { id: taskId } };
}
