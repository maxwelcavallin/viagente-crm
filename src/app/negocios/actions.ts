"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  contacts,
  customFieldDefinitions,
  dealTags,
  deals,
  lossReasons,
  pipelines,
  stages,
  stageTasks,
  tags,
  tasks,
  users,
} from "@/db/schema";
import {
  cancelActiveSequenceRuns,
  fireEtapaSequenceTriggers,
  fireStatusSequenceTriggers,
} from "@/lib/automation-sequences";
import { buildCustomFieldsFromForm } from "@/lib/custom-fields";
import { logDealActivity, type DealActivitySource } from "@/lib/deal-activity-log";
import { formatCurrencyBRL } from "@/lib/deal-format";
import { createAutomaticStageTasks, moveDealStage } from "@/lib/deal-mutations";
import { syncMeetingNotesForDeal } from "@/lib/meeting-notes-sync";
import {
  resolveDistributedOwner,
  syncContactOwnerFromDeal,
} from "@/lib/owner-distribution";
import { fireTagAddedAutomations, maybeAutoSendTask } from "@/lib/task-automation";
import { dispatchOutboundWebhooks } from "@/lib/webhook-outbound";

async function requireSession() {
  const session = await auth();
  return session?.user ?? null;
}

export type DealFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; dealId: string };

// Diff real (não delete-tudo-reinsere-tudo) — além de evitar reescrever
// linhas que não mudaram, preserva dealTags.createdAt das tags que já
// estavam lá (usado pelo gatilho "dias com a tag") e retorna só as tags
// genuinamente novas, pra disparar a automação de "tag adicionada". Também
// grava tag_adicionada/tag_removida no histórico (Etapa 24) pra cada tag
// que de fato mudou.
async function syncDealTags(
  dealId: string,
  tagIds: string[],
  logCtx: { userId: string | null; source: DealActivitySource }
): Promise<string[]> {
  const uniqueTagIds = Array.from(new Set(tagIds));
  const current = await db
    .select({ tagId: dealTags.tagId })
    .from(dealTags)
    .where(eq(dealTags.dealId, dealId));
  const currentIds = new Set(current.map((r) => r.tagId));

  const toAdd = uniqueTagIds.filter((id) => !currentIds.has(id));
  const toRemove = Array.from(currentIds).filter((id) => !uniqueTagIds.includes(id));

  if (toRemove.length > 0) {
    const removedTags = await db
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(inArray(tags.id, toRemove));
    await db
      .delete(dealTags)
      .where(and(eq(dealTags.dealId, dealId), inArray(dealTags.tagId, toRemove)));
    for (const tag of removedTags) {
      await logDealActivity({
        dealId,
        userId: logCtx.userId,
        source: logCtx.source,
        action: "tag_removida",
        oldValue: tag.name,
      });
    }
  }
  if (toAdd.length > 0) {
    const addedTags = await db
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(inArray(tags.id, toAdd));
    await db.insert(dealTags).values(toAdd.map((tagId) => ({ dealId, tagId })));
    for (const tag of addedTags) {
      await logDealActivity({
        dealId,
        userId: logCtx.userId,
        source: logCtx.source,
        action: "tag_adicionada",
        newValue: tag.name,
      });
    }
  }
  return toAdd;
}

// Diff campo a campo entre o negócio antes e depois de um updateDealAction —
// só grava entrada pra quem de fato mudou, com fieldName já traduzido pra
// label humana (não a chave raw) e valores formatados pra leitura (moeda,
// nome em vez de id). Etapa alterada sai como ação própria ('etapa_alterada'),
// não 'campo_alterado', pra diferenciar visualmente no histórico.
async function logDealFieldDiffs(
  userId: string,
  dealId: string,
  before: typeof deals.$inferSelect,
  after: {
    contactId: string;
    pipelineId: string;
    stageId: string;
    title: string;
    ownerId: string | null;
    value: string | null;
    customFields: Record<string, string>;
  }
): Promise<void> {
  const log = (fieldName: string, oldValue: string | null, newValue: string | null) =>
    logDealActivity({
      dealId,
      userId,
      source: "manual",
      action: "campo_alterado",
      fieldName,
      oldValue,
      newValue,
    });

  if (before.title !== after.title) {
    await log("Título", before.title, after.title);
  }
  if ((before.value ?? null) !== (after.value ?? null)) {
    await log("Valor", formatCurrencyBRL(before.value), formatCurrencyBRL(after.value));
  }
  if (before.ownerId !== after.ownerId) {
    const ids = [before.ownerId, after.ownerId].filter((v): v is string => v != null);
    const rows =
      ids.length > 0
        ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids))
        : [];
    const nameOf = (uid: string | null) =>
      uid ? (rows.find((r) => r.id === uid)?.name ?? "—") : "Sem dono";
    await log("Dono", nameOf(before.ownerId), nameOf(after.ownerId));
  }
  if (before.contactId !== after.contactId) {
    const rows = await db
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(inArray(contacts.id, [before.contactId, after.contactId]));
    const nameOf = (cid: string) => rows.find((r) => r.id === cid)?.name ?? "—";
    await log("Contato", nameOf(before.contactId), nameOf(after.contactId));
  }
  if (before.pipelineId !== after.pipelineId) {
    const rows = await db
      .select({ id: pipelines.id, name: pipelines.name })
      .from(pipelines)
      .where(inArray(pipelines.id, [before.pipelineId, after.pipelineId]));
    const nameOf = (pid: string) => rows.find((r) => r.id === pid)?.name ?? "—";
    await log("Pipeline", nameOf(before.pipelineId), nameOf(after.pipelineId));
  }
  if (before.stageId !== after.stageId) {
    const rows = await db
      .select({ id: stages.id, name: stages.name })
      .from(stages)
      .where(inArray(stages.id, [before.stageId, after.stageId]));
    const nameOf = (sid: string) => rows.find((r) => r.id === sid)?.name ?? "—";
    await logDealActivity({
      dealId,
      userId,
      source: "manual",
      action: "etapa_alterada",
      fieldName: "Etapa",
      oldValue: nameOf(before.stageId),
      newValue: nameOf(after.stageId),
    });
  }

  const beforeCustom = (before.customFields as Record<string, unknown>) ?? {};
  const changedKeys = new Set([...Object.keys(beforeCustom), ...Object.keys(after.customFields)]);
  if (changedKeys.size > 0) {
    const defs = await db
      .select({ key: customFieldDefinitions.key, label: customFieldDefinitions.label })
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.entity, "deal"));
    const labelOf = (key: string) => defs.find((d) => d.key === key)?.label ?? key;

    for (const key of changedKeys) {
      const oldVal = beforeCustom[key] != null ? String(beforeCustom[key]) : null;
      const newVal = after.customFields[key] != null ? String(after.customFields[key]) : null;
      if (oldVal !== newVal) {
        await log(labelOf(key), oldVal, newVal);
      }
    }
  }
}

function parseValue(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const amount = Number(raw.replace(",", "."));
  if (Number.isNaN(amount)) return null;
  return amount.toFixed(2);
}

type DealFieldsResult =
  | { error: string }
  | {
      contactId: string;
      pipelineId: string;
      stageId: string;
      title: string;
      ownerId: string | null;
      value: string | null;
      tagIds: string[];
      customFields: Record<string, string>;
    };

async function readDealFields(formData: FormData): Promise<DealFieldsResult> {
  const contactId = formData.get("contactId");
  const pipelineId = formData.get("pipelineId");
  const stageId = formData.get("stageId");

  if (typeof contactId !== "string" || !contactId) {
    return { error: "Selecione ou crie um contato." };
  }
  if (typeof pipelineId !== "string" || !pipelineId) {
    return { error: "Selecione uma pipeline." };
  }
  if (typeof stageId !== "string" || !stageId) {
    return { error: "Selecione uma etapa." };
  }

  const [stage] = await db
    .select({ id: stages.id, pipelineId: stages.pipelineId })
    .from(stages)
    .where(eq(stages.id, stageId))
    .limit(1);
  if (!stage || stage.pipelineId !== pipelineId) {
    return { error: "Etapa inválida para a pipeline selecionada." };
  }

  const titleRaw = formData.get("title");
  let title = typeof titleRaw === "string" ? titleRaw.trim() : "";
  if (!title) {
    const [contact] = await db
      .select({ name: contacts.name })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);
    if (!contact) return { error: "Contato não encontrado." };
    title = contact.name;
  }

  const ownerIdRaw = formData.get("ownerId");
  const ownerId =
    typeof ownerIdRaw === "string" && ownerIdRaw ? ownerIdRaw : null;

  const value = parseValue(formData.get("value"));
  const tagIds = formData
    .getAll("tagIds")
    .filter((v): v is string => typeof v === "string");

  const dealFieldDefs = await db
    .select({ key: customFieldDefinitions.key })
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.entity, "deal"));
  const customFields = await buildCustomFieldsFromForm(formData, dealFieldDefs);

  return {
    contactId,
    pipelineId,
    stageId,
    title,
    ownerId,
    value,
    tagIds,
    customFields,
  };
}

export async function createDealAction(
  _prevState: DealFormState,
  formData: FormData
): Promise<DealFormState> {
  const user = await requireSession();
  if (!user) return { status: "error", message: "Acesso negado." };

  const fields = await readDealFields(formData);
  if ("error" in fields) return { status: "error", message: fields.error };

  // Sem dono escolhido no form: tenta a regra de distribuição da pipeline
  // (ver Configurações > Pipelines > editar > Distribuição de donos) —
  // continua null se a pipeline não tiver regra configurada.
  const ownerId =
    fields.ownerId ?? (await resolveDistributedOwner(fields.pipelineId));

  const [created] = await db
    .insert(deals)
    .values({
      contactId: fields.contactId,
      pipelineId: fields.pipelineId,
      stageId: fields.stageId,
      title: fields.title,
      ownerId,
      value: fields.value,
      customFields: fields.customFields,
    })
    .returning({ id: deals.id });

  // Só propaga quando há um dono de fato (escolhido ou distribuído) — um
  // negócio novo sem dono não deve apagar o dono que o contato já tinha de
  // um negócio anterior.
  if (ownerId) await syncContactOwnerFromDeal(fields.contactId, ownerId);
  // Negócio nasce direto na etapa escolhida — precisa das mesmas tarefas
  // automáticas que ganharia se chegasse ali via "mover de etapa" (ver
  // createAutomaticStageTasks).
  await createAutomaticStageTasks(created.id, fields.stageId);
  await fireEtapaSequenceTriggers(created.id, fields.stageId);
  await logDealActivity({ dealId: created.id, userId: user.id, source: "manual", action: "criado" });
  const newTagIds = await syncDealTags(created.id, fields.tagIds, {
    userId: user.id,
    source: "manual",
  });
  await fireTagAddedAutomations(created.id, newTagIds);
  for (const tagId of newTagIds) void dispatchOutboundWebhooks("tag_adicionada", created.id, tagId);
  void dispatchOutboundWebhooks("negocio_criado", created.id);

  revalidatePath("/negocios");
  return { status: "success", dealId: created.id };
}

export async function updateDealAction(
  _prevState: DealFormState,
  formData: FormData
): Promise<DealFormState> {
  const user = await requireSession();
  if (!user) return { status: "error", message: "Acesso negado." };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Negócio inválido." };
  }

  const fields = await readDealFields(formData);
  if ("error" in fields) return { status: "error", message: fields.error };

  const [current] = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  if (!current) return { status: "error", message: "Negócio não encontrado." };
  const stageChanged = current.stageId !== fields.stageId;

  await db
    .update(deals)
    .set({
      contactId: fields.contactId,
      pipelineId: fields.pipelineId,
      stageId: fields.stageId,
      title: fields.title,
      ownerId: fields.ownerId,
      value: fields.value,
      customFields: fields.customFields,
      updatedAt: new Date(),
      // Editar o negócio pode trocar a etapa fora do fluxo normal do
      // kanban (moveDealStageAction) — sem isso, o gatilho "X dias na
      // etapa" ficaria contando a partir de uma entrada antiga/errada.
      ...(stageChanged ? { stageEnteredAt: new Date() } : {}),
    })
    .where(eq(deals.id, id));

  await syncContactOwnerFromDeal(fields.contactId, fields.ownerId);
  // Edição manual pode trocar a etapa fora do fluxo do kanban — mesma regra
  // de moveDealStage, senão a etapa nova fica sem as tarefas automáticas
  // configuradas pra ela.
  if (stageChanged) {
    await createAutomaticStageTasks(id, fields.stageId);
    await fireEtapaSequenceTriggers(id, fields.stageId);
  }
  await logDealFieldDiffs(user.id, id, current, fields);
  const newTagIds = await syncDealTags(id, fields.tagIds, { userId: user.id, source: "manual" });
  await fireTagAddedAutomations(id, newTagIds);
  for (const tagId of newTagIds) void dispatchOutboundWebhooks("tag_adicionada", id, tagId);

  revalidatePath("/negocios");
  revalidatePath(`/negocios/${id}`);
  return { status: "success", dealId: id };
}

export type DeleteDealState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function deleteDealAction(
  _prevState: DeleteDealState,
  formData: FormData
): Promise<DeleteDealState> {
  const user = await requireSession();
  if (!user) return { status: "error", message: "Acesso negado." };

  const id = formData.get("id");
  const redirectTo = formData.get("redirectTo");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Negócio inválido." };
  }

  const [deal] = await db.select({ title: deals.title }).from(deals).where(eq(deals.id, id)).limit(1);
  // Gravado antes do delete — como deal_activity_log.deal_id não tem FK
  // pra deals (de propósito, ver schema.ts), essa entrada sobrevive à
  // exclusão que ela mesma documenta.
  if (deal) {
    await logDealActivity({
      dealId: id,
      userId: user.id,
      source: "manual",
      action: "excluido",
      oldValue: deal.title,
    });
  }

  await db.delete(deals).where(eq(deals.id, id));

  revalidatePath("/negocios");
  if (typeof redirectTo === "string" && redirectTo) {
    redirect(redirectTo);
  }
  return { status: "idle" };
}

export async function moveDealStageAction(
  dealId: string,
  stageId: string
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user) return { ok: false };

  return moveDealStage(dealId, stageId, { userId: user.id, source: "manual" });
}

// "perdido" saiu daqui — precisa de motivo obrigatório, ver setDealLostAction.
// wonAt/lostAt são timestamps de transição (diferentes de updatedAt, que
// qualquer edição toca) — base dos indicadores por período na Início.
export async function setDealStatusAction(
  dealId: string,
  status: "aberto" | "ganho"
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user) return { ok: false };

  const [previous] = await db
    .select({ status: deals.status })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);

  await db
    .update(deals)
    .set({
      status,
      updatedAt: new Date(),
      wonAt: status === "ganho" ? new Date() : null,
      lostAt: null,
      lossReasonId: null,
    })
    .where(eq(deals.id, dealId));

  if (previous && previous.status !== status) {
    await logDealActivity({
      dealId,
      userId: user.id,
      source: "manual",
      // 'ganho' tem ação própria pra aparecer com destaque no histórico;
      // reabrir um negócio (voltar pra 'aberto') não tem ação dedicada no
      // enum, cai no fallback genérico 'editado'.
      action: status === "ganho" ? "ganho" : "editado",
      fieldName: "Status",
      oldValue: previous.status,
      newValue: status,
    });
  }

  if (status === "ganho") {
    await cancelActiveSequenceRuns(dealId);
    await fireStatusSequenceTriggers(dealId, "ganho");
    void dispatchOutboundWebhooks("negocio_ganho", dealId);
  }

  revalidatePath("/negocios");
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}

// Botão "Sincronizar reuniões" do card de Resumo de Reuniões — ver
// syncMeetingNotesForDeal (busca só pelo email do contato deste negócio, não
// varre tudo como o cron).
export type SyncMeetingNotesActionResult =
  | { ok: true; created: number; skipped: number; permissionError: boolean }
  | { ok: false; error: string };

export async function syncMeetingNotesAction(
  dealId: string
): Promise<SyncMeetingNotesActionResult> {
  const user = await requireSession();
  if (!user) return { ok: false, error: "Acesso negado." };

  const result = await syncMeetingNotesForDeal(dealId);
  if (result.ok) revalidatePath(`/negocios/${dealId}`);
  return result;
}

export async function setDealLostAction(
  dealId: string,
  lossReasonId: string
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user || !lossReasonId) return { ok: false };

  const [[previous], [reason]] = await Promise.all([
    db.select({ status: deals.status }).from(deals).where(eq(deals.id, dealId)).limit(1),
    db.select({ label: lossReasons.label }).from(lossReasons).where(eq(lossReasons.id, lossReasonId)).limit(1),
  ]);

  await db
    .update(deals)
    .set({
      status: "perdido",
      updatedAt: new Date(),
      lostAt: new Date(),
      lossReasonId,
      wonAt: null,
    })
    .where(eq(deals.id, dealId));

  await logDealActivity({
    dealId,
    userId: user.id,
    source: "manual",
    action: "perdido",
    fieldName: "Status",
    oldValue: previous?.status ?? null,
    newValue: reason ? `Perdido — ${reason.label}` : "Perdido",
  });

  await cancelActiveSequenceRuns(dealId);
  await fireStatusSequenceTriggers(dealId, "perdido");
  void dispatchOutboundWebhooks("negocio_perdido", dealId);

  revalidatePath("/negocios");
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}

export async function completeTaskAction(
  taskId: string,
  dealId: string
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user) return { ok: false };

  await db
    .update(tasks)
    .set({ status: "concluida", completedAt: new Date(), completedBy: user.id })
    .where(eq(tasks.id, taskId));

  revalidatePath(`/negocios/${dealId}`);
  revalidatePath("/negocios");
  revalidatePath("/tarefas");
  return { ok: true };
}

export async function updateTaskAction(
  taskId: string,
  dealId: string,
  fields: {
    title: string;
    type: "mensagem" | "ligacao" | "agendamento" | "generica" | "email";
    dueAt: string | null;
  }
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user || !fields.title.trim()) return { ok: false };

  await db
    .update(tasks)
    .set({
      title: fields.title.trim(),
      type: fields.type,
      dueAt: fields.dueAt ? new Date(fields.dueAt) : null,
    })
    .where(eq(tasks.id, taskId));

  revalidatePath(`/negocios/${dealId}`);
  revalidatePath("/negocios");
  revalidatePath("/tarefas");
  return { ok: true };
}

export async function deleteTaskAction(
  taskId: string,
  dealId: string
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user) return { ok: false };

  await db.delete(tasks).where(eq(tasks.id, taskId));

  revalidatePath(`/negocios/${dealId}`);
  revalidatePath("/negocios");
  revalidatePath("/tarefas");
  return { ok: true };
}

// Adiciona manualmente uma tarefa "modelo" (stage_task com isAutomatic=false)
// ao negócio — usada quando a etapa tem tarefas configuradas só como opção,
// não pra criação automática ao entrar na etapa.
export async function addStageTaskToDealAction(
  dealId: string,
  stageTaskId: string
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user) return { ok: false };

  const [stageTask] = await db
    .select({
      title: stageTasks.title,
      type: stageTasks.type,
      daysToComplete: stageTasks.daysToComplete,
      autoSend: stageTasks.autoSend,
      autoSendChannelId: stageTasks.autoSendChannelId,
      messageTemplateId: stageTasks.messageTemplateId,
    })
    .from(stageTasks)
    .where(eq(stageTasks.id, stageTaskId))
    .limit(1);
  if (!stageTask) return { ok: false };

  const dueAt =
    stageTask.daysToComplete != null
      ? new Date(Date.now() + stageTask.daysToComplete * 24 * 60 * 60 * 1000)
      : null;

  const [created] = await db
    .insert(tasks)
    .values({
      dealId,
      stageTaskId,
      title: stageTask.title,
      type: stageTask.type,
      status: "pendente",
      dueAt,
    })
    .returning({ id: tasks.id });

  await maybeAutoSendTask({
    taskId: created.id,
    dealId,
    type: stageTask.type,
    dueAt,
    autoSend: stageTask.autoSend,
    autoSendChannelId: stageTask.autoSendChannelId,
    messageTemplateId: stageTask.messageTemplateId,
  });

  revalidatePath(`/negocios/${dealId}`);
  revalidatePath("/negocios");
  return { ok: true };
}

// ---------- Ações em massa (seleção múltipla no kanban) ----------

export async function bulkMoveDealsAction(
  dealIds: string[],
  stageId: string
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user || dealIds.length === 0) return { ok: false };

  const before = await db
    .select({ id: deals.id, stageId: deals.stageId })
    .from(deals)
    .where(inArray(deals.id, dealIds));

  await db
    .update(deals)
    .set({ stageId, updatedAt: new Date(), stageEnteredAt: new Date() })
    .where(inArray(deals.id, dealIds));

  const changed = before.filter((d) => d.stageId !== stageId);
  if (changed.length > 0) {
    const stageRows = await db
      .select({ id: stages.id, name: stages.name })
      .from(stages)
      .where(inArray(stages.id, [...new Set(changed.map((d) => d.stageId)), stageId]));
    const nameOf = (sid: string) => stageRows.find((s) => s.id === sid)?.name ?? "—";
    for (const deal of changed) {
      await logDealActivity({
        dealId: deal.id,
        userId: user.id,
        source: "manual",
        action: "etapa_alterada",
        fieldName: "Etapa",
        oldValue: nameOf(deal.stageId),
        newValue: nameOf(stageId),
      });
    }
  }

  revalidatePath("/negocios");
  return { ok: true };
}

export async function bulkSetOwnerAction(
  dealIds: string[],
  ownerId: string | null
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user || dealIds.length === 0) return { ok: false };

  const affected = await db
    .select({ contactId: deals.contactId })
    .from(deals)
    .where(inArray(deals.id, dealIds));

  await db
    .update(deals)
    .set({ ownerId, updatedAt: new Date() })
    .where(inArray(deals.id, dealIds));

  for (const row of affected) {
    await syncContactOwnerFromDeal(row.contactId, ownerId);
  }

  revalidatePath("/negocios");
  return { ok: true };
}

export async function bulkSetStatusAction(
  dealIds: string[],
  status: "aberto" | "ganho"
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user || dealIds.length === 0) return { ok: false };

  const before = await db
    .select({ id: deals.id, status: deals.status })
    .from(deals)
    .where(inArray(deals.id, dealIds));

  await db
    .update(deals)
    .set({
      status,
      updatedAt: new Date(),
      wonAt: status === "ganho" ? new Date() : null,
      lostAt: null,
      lossReasonId: null,
    })
    .where(inArray(deals.id, dealIds));

  for (const deal of before) {
    if (deal.status === status) continue;
    await logDealActivity({
      dealId: deal.id,
      userId: user.id,
      source: "manual",
      action: status === "ganho" ? "ganho" : "editado",
      fieldName: "Status",
      oldValue: deal.status,
      newValue: status,
    });
    // Mesmo disparo de setDealStatusAction — sem isso, marcar como ganho em
    // lote nunca aciona sequência nem webhook de saída (só o botão de
    // negócio único fazia isso).
    if (status === "ganho") {
      await cancelActiveSequenceRuns(deal.id);
      await fireStatusSequenceTriggers(deal.id, "ganho");
      void dispatchOutboundWebhooks("negocio_ganho", deal.id);
    }
  }

  revalidatePath("/negocios");
  return { ok: true };
}

export async function bulkSetLostAction(
  dealIds: string[],
  lossReasonId: string
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user || dealIds.length === 0 || !lossReasonId) return { ok: false };

  const [before, [reason]] = await Promise.all([
    db.select({ id: deals.id, status: deals.status }).from(deals).where(inArray(deals.id, dealIds)),
    db.select({ label: lossReasons.label }).from(lossReasons).where(eq(lossReasons.id, lossReasonId)).limit(1),
  ]);

  await db
    .update(deals)
    .set({
      status: "perdido",
      updatedAt: new Date(),
      lostAt: new Date(),
      lossReasonId,
      wonAt: null,
    })
    .where(inArray(deals.id, dealIds));

  for (const deal of before) {
    await logDealActivity({
      dealId: deal.id,
      userId: user.id,
      source: "manual",
      action: "perdido",
      fieldName: "Status",
      oldValue: deal.status,
      newValue: reason ? `Perdido — ${reason.label}` : "Perdido",
    });
    // Mesmo disparo de setDealLostAction — ver comentário em bulkSetStatusAction.
    await cancelActiveSequenceRuns(deal.id);
    await fireStatusSequenceTriggers(deal.id, "perdido");
    void dispatchOutboundWebhooks("negocio_perdido", deal.id);
  }

  revalidatePath("/negocios");
  return { ok: true };
}

export async function bulkAddTagAction(
  dealIds: string[],
  tagId: string
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user || dealIds.length === 0) return { ok: false };

  // onConflictDoNothing().returning() só retorna as linhas que de fato
  // foram inseridas (deals que ainda não tinham a tag) — usado pra saber
  // exatamente pra quem disparar a automação de "tag adicionada", sem
  // reprocessar deals que já tinham a tag.
  const inserted = await db
    .insert(dealTags)
    .values(dealIds.map((dealId) => ({ dealId, tagId })))
    .onConflictDoNothing()
    .returning({ dealId: dealTags.dealId });

  if (inserted.length > 0) {
    const [tag] = await db.select({ name: tags.name }).from(tags).where(eq(tags.id, tagId)).limit(1);
    for (const row of inserted) {
      await logDealActivity({
        dealId: row.dealId,
        userId: user.id,
        source: "manual",
        action: "tag_adicionada",
        newValue: tag?.name ?? null,
      });
      await fireTagAddedAutomations(row.dealId, [tagId]);
      void dispatchOutboundWebhooks("tag_adicionada", row.dealId, tagId);
    }
  }

  revalidatePath("/negocios");
  return { ok: true };
}

export async function bulkDeleteDealsAction(
  dealIds: string[]
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user || dealIds.length === 0) return { ok: false };

  const before = await db.select({ id: deals.id, title: deals.title }).from(deals).where(inArray(deals.id, dealIds));
  for (const deal of before) {
    await logDealActivity({
      dealId: deal.id,
      userId: user.id,
      source: "manual",
      action: "excluido",
      oldValue: deal.title,
    });
  }

  await db.delete(deals).where(inArray(deals.id, dealIds));

  revalidatePath("/negocios");
  return { ok: true };
}
