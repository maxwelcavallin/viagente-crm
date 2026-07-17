import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  contacts,
  customFieldDefinitions,
  dealTags,
  deals,
  messageTemplates,
  stageTasks,
  tagAutomations,
  tasks,
} from "@/db/schema";
import { fireTagSequenceTriggers } from "@/lib/automation-sequences";
import { formatCustomFieldValue, type FieldDef } from "@/lib/custom-fields";
import { formatCurrencyBRL } from "@/lib/deal-format";
import { sendTextMessage } from "@/lib/send-message";
import { substituteTemplate } from "@/lib/templates";

type TaskType = "mensagem" | "ligacao" | "agendamento" | "generica" | "email";

// Mesmo catálogo de variáveis usado em /tarefas (nome_contato, valor +
// custom fields de negócio/contato) — centralizado aqui pra ser reaproveitado
// pelo envio automático.
async function buildTemplateVariables(
  dealId: string
): Promise<{ contactId: string; variableValues: Record<string, string> } | null> {
  const [row] = await db
    .select({
      dealValue: deals.value,
      dealCustomFields: deals.customFields,
      contactId: contacts.id,
      contactName: contacts.name,
      contactEmail: contacts.email,
      contactCustomFields: contacts.customFields,
    })
    .from(deals)
    .innerJoin(contacts, eq(deals.contactId, contacts.id))
    .where(eq(deals.id, dealId))
    .limit(1);
  if (!row) return null;

  const fieldDefRows = await db.select().from(customFieldDefinitions);
  const dealCustomFields = (row.dealCustomFields as Record<string, unknown>) ?? {};
  const contactCustomFields = (row.contactCustomFields as Record<string, unknown>) ?? {};

  const variableValues: Record<string, string> = {
    nome_contato: row.contactName,
    email_contato: row.contactEmail ?? "",
    valor: formatCurrencyBRL(row.dealValue) ?? "",
  };
  for (const def of fieldDefRows) {
    const fieldDef: FieldDef = {
      id: def.id,
      key: def.key,
      label: def.label,
      type: def.type,
      options: def.options as { value: string; label: string }[] | null,
    };
    const source = def.entity === "deal" ? dealCustomFields : contactCustomFields;
    if (source[def.key] != null) {
      variableValues[def.key] = formatCustomFieldValue(fieldDef, source[def.key]);
    }
  }
  return { contactId: row.contactId, variableValues };
}

// Chamado logo após inserir uma task automática (entrada de etapa, tag
// adicionada, ou pelo cron pros gatilhos com atraso). Só age quando a
// automação de origem tem autoSend ligado — senão a task fica pendente
// esperando execução manual, comportamento original da Etapa 9.
export async function maybeAutoSendTask(params: {
  taskId: string;
  dealId: string;
  type: TaskType;
  dueAt: Date | null;
  autoSend: boolean;
  autoSendChannelId: string | null;
  messageTemplateId: string | null;
}): Promise<void> {
  if (!params.autoSend) return;
  if (params.type !== "mensagem") return;
  if (!params.autoSendChannelId || !params.messageTemplateId) return;
  // Tem prazo no futuro: fica pendente, o cron reavalia quando vencer.
  if (params.dueAt && params.dueAt.getTime() > Date.now()) return;

  const built = await buildTemplateVariables(params.dealId);
  if (!built) return;

  const [template] = await db
    .select({ content: messageTemplates.content })
    .from(messageTemplates)
    .where(eq(messageTemplates.id, params.messageTemplateId))
    .limit(1);
  if (!template) return;

  const text = substituteTemplate(template.content, built.variableValues);

  const result = await sendTextMessage({
    channelId: params.autoSendChannelId,
    contactId: built.contactId,
    message: text,
  });

  if (result.ok) {
    await db
      .update(tasks)
      .set({ status: "concluida", completedAt: new Date() })
      .where(eq(tasks.id, params.taskId));
  } else {
    console.error(
      `[task-automation] falha ao auto-enviar task ${params.taskId}: ${result.error}`
    );
  }
}

// Chamado sincronamente logo após anexar tags novas a um negócio (form de
// negócio, ação em massa, webhook de entrada, importação CSV). Cria as
// tasks de automações com trigger='tag_adicionada' pras tags recém-anexadas,
// dispara o auto-send na hora se configurado, e também as sequências da
// Etapa 22 com gatilho por tag (fireTagSequenceTriggers) — mesmo evento,
// mesmo choke point, pra nenhum call site precisar lembrar de disparar os
// dois motores separadamente.
export async function fireTagAddedAutomations(
  dealId: string,
  newlyAddedTagIds: string[]
): Promise<void> {
  if (newlyAddedTagIds.length === 0) return;

  const rules = await db
    .select()
    .from(tagAutomations)
    .where(eq(tagAutomations.trigger, "tag_adicionada"));
  const matching = rules.filter((r) => newlyAddedTagIds.includes(r.tagId));

  for (const rule of matching) {
    const [created] = await db
      .insert(tasks)
      .values({
        dealId,
        tagAutomationId: rule.id,
        title: rule.title,
        type: rule.type,
        status: "pendente",
      })
      .returning({ id: tasks.id });

    await maybeAutoSendTask({
      taskId: created.id,
      dealId,
      type: rule.type,
      dueAt: null,
      autoSend: rule.autoSend,
      autoSendChannelId: rule.autoSendChannelId,
      messageTemplateId: rule.messageTemplateId,
    });
  }

  await fireTagSequenceTriggers(dealId, newlyAddedTagIds);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

// Varredura periódica (cron) pros dois gatilhos com atraso — não são
// eventos síncronos, alguém precisa checar "já passou tempo suficiente?"
// periodicamente — e pro auto-send de tasks que nasceram com prazo futuro
// (daysToComplete) e já venceram.
export async function runDelayedAutomationSweep(): Promise<{
  stageTasksCreated: number;
  tagAutomationsCreated: number;
  autoSent: number;
}> {
  const now = Date.now();
  let stageTasksCreated = 0;
  let tagAutomationsCreated = 0;

  // A. stage_tasks com triggerDelayMinutes: negócio precisa estar na etapa
  // certa há tempo suficiente, e ainda não ter ganho a task nesta "visita"
  // (task criada em/depois de stageEnteredAt).
  const delayedStageTasks = await db
    .select({
      stageTaskId: stageTasks.id,
      stageId: stageTasks.stageId,
      title: stageTasks.title,
      type: stageTasks.type,
      daysToComplete: stageTasks.daysToComplete,
      triggerDelayMinutes: stageTasks.triggerDelayMinutes,
      autoSend: stageTasks.autoSend,
      autoSendChannelId: stageTasks.autoSendChannelId,
      messageTemplateId: stageTasks.messageTemplateId,
    })
    .from(stageTasks)
    .where(eq(stageTasks.isAutomatic, true));

  for (const st of delayedStageTasks) {
    if (st.triggerDelayMinutes == null) continue;

    const dealsInStage = await db
      .select({ id: deals.id, stageEnteredAt: deals.stageEnteredAt })
      .from(deals)
      .where(eq(deals.stageId, st.stageId));

    for (const deal of dealsInStage) {
      const elapsedMs = now - deal.stageEnteredAt.getTime();
      if (elapsedMs < st.triggerDelayMinutes * MS_PER_MINUTE) continue;

      const [alreadyFired] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.dealId, deal.id),
            eq(tasks.stageTaskId, st.stageTaskId),
            gte(tasks.createdAt, deal.stageEnteredAt)
          )
        )
        .limit(1);
      if (alreadyFired) continue;

      const dueAt =
        st.daysToComplete != null
          ? new Date(now + st.daysToComplete * MS_PER_DAY)
          : null;

      const [created] = await db
        .insert(tasks)
        .values({
          dealId: deal.id,
          stageTaskId: st.stageTaskId,
          title: st.title,
          type: st.type,
          status: "pendente",
          dueAt,
        })
        .returning({ id: tasks.id });
      stageTasksCreated += 1;

      await maybeAutoSendTask({
        taskId: created.id,
        dealId: deal.id,
        type: st.type,
        dueAt,
        autoSend: st.autoSend,
        autoSendChannelId: st.autoSendChannelId,
        messageTemplateId: st.messageTemplateId,
      });
    }
  }

  // B. tag_automations com trigger='dias_apos_tag': mesmo raciocínio usando
  // deal_tags.created_at.
  const delayedTagRules = await db
    .select()
    .from(tagAutomations)
    .where(eq(tagAutomations.trigger, "dias_apos_tag"));

  for (const rule of delayedTagRules) {
    if (rule.delayMinutes == null) continue;

    const taggedDeals = await db
      .select({ dealId: dealTags.dealId, createdAt: dealTags.createdAt })
      .from(dealTags)
      .where(eq(dealTags.tagId, rule.tagId));

    for (const dt of taggedDeals) {
      const elapsedMs = now - dt.createdAt.getTime();
      if (elapsedMs < rule.delayMinutes * MS_PER_MINUTE) continue;

      const [alreadyFired] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.dealId, dt.dealId),
            eq(tasks.tagAutomationId, rule.id),
            gte(tasks.createdAt, dt.createdAt)
          )
        )
        .limit(1);
      if (alreadyFired) continue;

      const [created] = await db
        .insert(tasks)
        .values({
          dealId: dt.dealId,
          tagAutomationId: rule.id,
          title: rule.title,
          type: rule.type,
          status: "pendente",
        })
        .returning({ id: tasks.id });
      tagAutomationsCreated += 1;

      await maybeAutoSendTask({
        taskId: created.id,
        dealId: dt.dealId,
        type: rule.type,
        dueAt: null,
        autoSend: rule.autoSend,
        autoSendChannelId: rule.autoSendChannelId,
        messageTemplateId: rule.messageTemplateId,
      });
    }
  }

  // C. Tasks pendentes com autoSend na origem e prazo já vencido (ou sem
  // prazo, caso raro de terem escapado do envio síncrono na criação).
  const pendingMessageTasks = await db
    .select({
      id: tasks.id,
      dealId: tasks.dealId,
      dueAt: tasks.dueAt,
      stageTaskAutoSend: stageTasks.autoSend,
      stageTaskChannelId: stageTasks.autoSendChannelId,
      stageTaskTemplateId: stageTasks.messageTemplateId,
      tagRuleAutoSend: tagAutomations.autoSend,
      tagRuleChannelId: tagAutomations.autoSendChannelId,
      tagRuleTemplateId: tagAutomations.messageTemplateId,
    })
    .from(tasks)
    .leftJoin(stageTasks, eq(tasks.stageTaskId, stageTasks.id))
    .leftJoin(tagAutomations, eq(tasks.tagAutomationId, tagAutomations.id))
    .where(
      and(
        eq(tasks.type, "mensagem"),
        eq(tasks.status, "pendente"),
        or(isNull(tasks.dueAt), lte(tasks.dueAt, new Date(now)))
      )
    );

  let autoSent = 0;
  for (const t of pendingMessageTasks) {
    const autoSend = t.stageTaskAutoSend ?? t.tagRuleAutoSend ?? false;
    const autoSendChannelId = t.stageTaskChannelId ?? t.tagRuleChannelId ?? null;
    const messageTemplateId = t.stageTaskTemplateId ?? t.tagRuleTemplateId ?? null;
    if (!autoSend) continue;

    await maybeAutoSendTask({
      taskId: t.id,
      dealId: t.dealId,
      type: "mensagem",
      dueAt: t.dueAt,
      autoSend,
      autoSendChannelId,
      messageTemplateId,
    });
    autoSent += 1;
  }

  return { stageTasksCreated, tagAutomationsCreated, autoSent };
}
