"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  contacts,
  customFieldDefinitions,
  dealTags,
  deals,
  stages,
  stageTasks,
  tasks,
} from "@/db/schema";
import { buildCustomFieldsFromForm } from "@/lib/custom-fields";
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
// genuinamente novas, pra disparar a automação de "tag adicionada".
async function syncDealTags(dealId: string, tagIds: string[]): Promise<string[]> {
  const uniqueTagIds = Array.from(new Set(tagIds));
  const current = await db
    .select({ tagId: dealTags.tagId })
    .from(dealTags)
    .where(eq(dealTags.dealId, dealId));
  const currentIds = new Set(current.map((r) => r.tagId));

  const toAdd = uniqueTagIds.filter((id) => !currentIds.has(id));
  const toRemove = Array.from(currentIds).filter((id) => !uniqueTagIds.includes(id));

  if (toRemove.length > 0) {
    await db
      .delete(dealTags)
      .where(and(eq(dealTags.dealId, dealId), inArray(dealTags.tagId, toRemove)));
  }
  if (toAdd.length > 0) {
    await db.insert(dealTags).values(toAdd.map((tagId) => ({ dealId, tagId })));
  }
  return toAdd;
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

  const [created] = await db
    .insert(deals)
    .values({
      contactId: fields.contactId,
      pipelineId: fields.pipelineId,
      stageId: fields.stageId,
      title: fields.title,
      ownerId: fields.ownerId,
      value: fields.value,
      customFields: fields.customFields,
    })
    .returning({ id: deals.id });

  const newTagIds = await syncDealTags(created.id, fields.tagIds);
  await fireTagAddedAutomations(created.id, newTagIds);
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

  const [current] = await db
    .select({ stageId: deals.stageId })
    .from(deals)
    .where(eq(deals.id, id))
    .limit(1);
  const stageChanged = current != null && current.stageId !== fields.stageId;

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

  const newTagIds = await syncDealTags(id, fields.tagIds);
  await fireTagAddedAutomations(id, newTagIds);

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

  await db
    .update(deals)
    .set({ stageId, updatedAt: new Date(), stageEnteredAt: new Date() })
    .where(eq(deals.id, dealId));

  // Cria as tarefas automáticas da etapa de destino (Etapa 9). Só as
  // marcadas isAutomatic=true — as demais ficam como modelo disponível pra
  // adicionar manualmente (ver addStageTaskToDealAction). Se o negócio já
  // visitou essa etapa antes, cria de novo — não reaproveita tarefas antigas
  // já concluídas (regra explícita do critério de aceite). Tarefas com
  // triggerDelayDays setado NÃO entram aqui — ficam pro cron de automação
  // varrer quando o prazo em dias na etapa for atingido.
  const tasksForStage = await db
    .select({
      id: stageTasks.id,
      title: stageTasks.title,
      type: stageTasks.type,
      daysToComplete: stageTasks.daysToComplete,
      autoSend: stageTasks.autoSend,
      autoSendChannelId: stageTasks.autoSendChannelId,
      messageTemplateId: stageTasks.messageTemplateId,
    })
    .from(stageTasks)
    .where(
      and(
        eq(stageTasks.stageId, stageId),
        eq(stageTasks.isAutomatic, true),
        isNull(stageTasks.triggerDelayDays)
      )
    );

  if (tasksForStage.length > 0) {
    const now = Date.now();
    const inserted = await db
      .insert(tasks)
      .values(
        tasksForStage.map((st) => ({
          dealId,
          stageTaskId: st.id,
          title: st.title,
          type: st.type,
          status: "pendente" as const,
          dueAt:
            st.daysToComplete != null
              ? new Date(now + st.daysToComplete * 24 * 60 * 60 * 1000)
              : null,
        }))
      )
      .returning({ id: tasks.id, stageTaskId: tasks.stageTaskId, dueAt: tasks.dueAt });

    for (const task of inserted) {
      const source = tasksForStage.find((st) => st.id === task.stageTaskId);
      if (!source) continue;
      await maybeAutoSendTask({
        taskId: task.id,
        dealId,
        type: source.type,
        dueAt: task.dueAt,
        autoSend: source.autoSend,
        autoSendChannelId: source.autoSendChannelId,
        messageTemplateId: source.messageTemplateId,
      });
    }
  }

  void dispatchOutboundWebhooks("etapa_alterada", dealId);

  revalidatePath("/negocios");
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
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

  if (status === "ganho") void dispatchOutboundWebhooks("negocio_ganho", dealId);

  revalidatePath("/negocios");
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}

export async function setDealLostAction(
  dealId: string,
  lossReasonId: string
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user || !lossReasonId) return { ok: false };

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
    type: "mensagem" | "ligacao" | "agendamento" | "generica";
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

  await db
    .update(deals)
    .set({ stageId, updatedAt: new Date(), stageEnteredAt: new Date() })
    .where(inArray(deals.id, dealIds));

  revalidatePath("/negocios");
  return { ok: true };
}

export async function bulkSetOwnerAction(
  dealIds: string[],
  ownerId: string | null
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user || dealIds.length === 0) return { ok: false };

  await db
    .update(deals)
    .set({ ownerId, updatedAt: new Date() })
    .where(inArray(deals.id, dealIds));

  revalidatePath("/negocios");
  return { ok: true };
}

export async function bulkSetStatusAction(
  dealIds: string[],
  status: "aberto" | "ganho"
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user || dealIds.length === 0) return { ok: false };

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

  revalidatePath("/negocios");
  return { ok: true };
}

export async function bulkSetLostAction(
  dealIds: string[],
  lossReasonId: string
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user || dealIds.length === 0 || !lossReasonId) return { ok: false };

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

  for (const row of inserted) {
    await fireTagAddedAutomations(row.dealId, [tagId]);
  }

  revalidatePath("/negocios");
  return { ok: true };
}

export async function bulkDeleteDealsAction(
  dealIds: string[]
): Promise<{ ok: boolean }> {
  const user = await requireSession();
  if (!user || dealIds.length === 0) return { ok: false };

  await db.delete(deals).where(inArray(deals.id, dealIds));

  revalidatePath("/negocios");
  return { ok: true };
}
