import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  automationSequenceRuns,
  automationSequenceSteps,
  automationSequences,
  dealTags,
  deals,
  messages,
  stages,
  tags,
  tasks,
} from "@/db/schema";
import { logDealActivity } from "@/lib/deal-activity-log";
import { maybeAutoSendTask } from "@/lib/task-automation";
import { dispatchOutboundWebhooks } from "@/lib/webhook-outbound";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

type SequenceCondition = {
  field: string;
  operator: "eq" | "gt" | "lt" | "contains";
  value: string;
} | null;

type StepRow = typeof automationSequenceSteps.$inferSelect;
type RunRow = typeof automationSequenceRuns.$inferSelect;

// Condição simples opcional sobre o negócio, avaliada só no momento do
// gatilho (não a cada passo — ver critério de aceite da Etapa 22).
async function conditionMatches(dealId: string, condition: SequenceCondition): Promise<boolean> {
  if (!condition) return true;

  if (condition.field === "tags") {
    if (condition.operator !== "contains") return false;
    const rows = await db
      .select({ name: tags.name })
      .from(dealTags)
      .innerJoin(tags, eq(dealTags.tagId, tags.id))
      .where(eq(dealTags.dealId, dealId));
    return rows.some((r) => r.name === condition.value);
  }

  const [deal] = await db
    .select({ temperature: deals.temperature, customFields: deals.customFields })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (!deal) return false;

  const raw =
    condition.field === "temperature"
      ? deal.temperature
      : (deal.customFields as Record<string, unknown>)?.[condition.field];
  if (raw == null) return false;

  switch (condition.operator) {
    case "eq":
      return String(raw) === condition.value;
    case "contains":
      return String(raw).toLowerCase().includes(condition.value.toLowerCase());
    case "gt":
      return Number(raw) > Number(condition.value);
    case "lt":
      return Number(raw) < Number(condition.value);
  }
}

// Ponto único de criação de run — evita duplicar uma sequência já em
// andamento pro mesmo negócio (ex: negócio reentra na mesma etapa, ou a tag
// é removida e adicionada de novo antes da sequência anterior terminar).
async function createRun(sequenceId: string, dealId: string): Promise<void> {
  const [alreadyRunning] = await db
    .select({ id: automationSequenceRuns.id })
    .from(automationSequenceRuns)
    .where(
      and(
        eq(automationSequenceRuns.sequenceId, sequenceId),
        eq(automationSequenceRuns.dealId, dealId),
        eq(automationSequenceRuns.status, "em_andamento")
      )
    )
    .limit(1);
  if (alreadyRunning) return;

  const [firstStep] = await db
    .select({ order: automationSequenceSteps.order, delayMinutes: automationSequenceSteps.delayMinutes })
    .from(automationSequenceSteps)
    .where(eq(automationSequenceSteps.sequenceId, sequenceId))
    .orderBy(asc(automationSequenceSteps.order))
    .limit(1);
  if (!firstStep) return; // sequência sem passos — nada a agendar

  const now = new Date();
  await db.insert(automationSequenceRuns).values({
    sequenceId,
    dealId,
    currentStepOrder: firstStep.order,
    status: "em_andamento",
    startedAt: now,
    nextStepAt: new Date(now.getTime() + firstStep.delayMinutes * MS_PER_MINUTE),
  });
}

// Chamado sincronamente por moveDealStageAction quando o negócio entra numa
// etapa nova — mesmo instante em que as stage_tasks isAutomatic da Etapa 9
// são criadas.
export async function fireEtapaSequenceTriggers(dealId: string, stageId: string): Promise<void> {
  const sequences = await db
    .select()
    .from(automationSequences)
    .where(
      and(
        eq(automationSequences.active, true),
        eq(automationSequences.triggerType, "etapa"),
        eq(automationSequences.triggerStageId, stageId)
      )
    );

  for (const seq of sequences) {
    if (!(await conditionMatches(dealId, seq.conditions as SequenceCondition))) continue;
    await createRun(seq.id, dealId);
  }
}

// Chamado de dentro de fireTagAddedAutomations (task-automation.ts) — mesmo
// evento síncrono que dispara tag_automations.
export async function fireTagSequenceTriggers(
  dealId: string,
  newlyAddedTagIds: string[]
): Promise<void> {
  if (newlyAddedTagIds.length === 0) return;

  const sequences = await db
    .select()
    .from(automationSequences)
    .where(and(eq(automationSequences.active, true), eq(automationSequences.triggerType, "tag")));
  const matching = sequences.filter(
    (s) => s.triggerTagId && newlyAddedTagIds.includes(s.triggerTagId)
  );

  for (const seq of matching) {
    if (!(await conditionMatches(dealId, seq.conditions as SequenceCondition))) continue;
    await createRun(seq.id, dealId);
  }
}

// Chamado por setDealStatusAction (ganho) e setDealLostAction (perdido) —
// exclusão de negócio já cancela via ON DELETE CASCADE em
// automation_sequence_runs.deal_id, não precisa de código extra aqui.
export async function cancelActiveSequenceRuns(dealId: string): Promise<void> {
  await db
    .update(automationSequenceRuns)
    .set({ status: "cancelada" })
    .where(
      and(
        eq(automationSequenceRuns.dealId, dealId),
        eq(automationSequenceRuns.status, "em_andamento")
      )
    );
}

async function executeStep(run: RunRow, step: StepRow): Promise<void> {
  switch (step.type) {
    case "tag": {
      if (!step.addTagId) break;
      const inserted = await db
        .insert(dealTags)
        .values({ dealId: run.dealId, tagId: step.addTagId })
        .onConflictDoNothing()
        .returning({ dealId: dealTags.dealId });
      if (inserted.length > 0) {
        const [tag] = await db.select({ name: tags.name }).from(tags).where(eq(tags.id, step.addTagId)).limit(1);
        await logDealActivity({
          dealId: run.dealId,
          userId: null,
          source: "automacao",
          action: "tag_adicionada",
          newValue: tag?.name ?? null,
        });
        void dispatchOutboundWebhooks("tag_adicionada", run.dealId, step.addTagId);
      }
      break;
    }
    case "mudar_etapa": {
      if (!step.moveToStageId) break;
      const [previous] = await db
        .select({ stageId: deals.stageId })
        .from(deals)
        .where(eq(deals.id, run.dealId))
        .limit(1);
      await db
        .update(deals)
        .set({ stageId: step.moveToStageId, stageEnteredAt: new Date(), updatedAt: new Date() })
        .where(eq(deals.id, run.dealId));
      if (previous && previous.stageId !== step.moveToStageId) {
        const stageRows = await db
          .select({ id: stages.id, name: stages.name })
          .from(stages)
          .where(inArray(stages.id, [previous.stageId, step.moveToStageId]));
        const nameOf = (sid: string) => stageRows.find((s) => s.id === sid)?.name ?? "—";
        await logDealActivity({
          dealId: run.dealId,
          userId: null,
          source: "automacao",
          action: "etapa_alterada",
          fieldName: "Etapa",
          oldValue: nameOf(previous.stageId),
          newValue: nameOf(step.moveToStageId),
        });
      }
      break;
    }
    case "tarefa_generica": {
      await db.insert(tasks).values({
        dealId: run.dealId,
        sequenceStepId: step.id,
        title: step.title ?? "Tarefa da sequência",
        type: "generica",
        status: "pendente",
      });
      break;
    }
    case "mensagem": {
      const [created] = await db
        .insert(tasks)
        .values({
          dealId: run.dealId,
          sequenceStepId: step.id,
          title: step.title ?? "Enviar mensagem (sequência)",
          type: "mensagem",
          status: "pendente",
        })
        .returning({ id: tasks.id });

      await maybeAutoSendTask({
        taskId: created.id,
        dealId: run.dealId,
        type: "mensagem",
        dueAt: null,
        autoSend: step.autoSend,
        autoSendChannelId: step.autoSendChannelId,
        messageTemplateId: step.messageTemplateId,
      });
      break;
    }
  }
}

// Detecta negócios elegíveis ao gatilho 'sem_resposta': última mensagem do
// negócio foi enviada pelo CRM (saida) há mais de noResponseDays dias, sem
// nenhuma resposta do contato depois. DISTINCT ON + CTE, mesmo mecanismo já
// usado em getDashboardSummary (Etapa 21) pro tempo médio de 1ª resposta.
async function findNoResponseDealIds(noResponseDays: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - noResponseDays * MS_PER_DAY);
  const result = await db.execute(sql`
    WITH last_msg AS (
      SELECT DISTINCT ON (deal_id) deal_id, direction, created_at
      FROM messages
      WHERE deal_id IS NOT NULL
      ORDER BY deal_id, created_at DESC
    )
    SELECT lm.deal_id AS deal_id
    FROM last_msg lm
    JOIN deals d ON d.id = lm.deal_id AND d.status = 'aberto'
    WHERE lm.direction = 'saida' AND lm.created_at <= ${cutoff}
  `);
  const rows =
    (result as unknown as { rows?: { deal_id: string }[] }).rows ??
    (result as unknown as { deal_id: string }[]);
  return rows.map((r) => r.deal_id);
}

// Um negócio não deve receber a mesma sequência de follow-up mais de uma vez
// seguida sem uma mensagem nova do contato no meio: se já existe um run
// (de qualquer status) e nenhuma mensagem 'entrada' chegou depois dele,
// pula — o silêncio atual já gerou um disparo.
async function alreadyFiredSinceLastReply(sequenceId: string, dealId: string): Promise<boolean> {
  const [lastRun] = await db
    .select({ startedAt: automationSequenceRuns.startedAt })
    .from(automationSequenceRuns)
    .where(and(eq(automationSequenceRuns.sequenceId, sequenceId), eq(automationSequenceRuns.dealId, dealId)))
    .orderBy(desc(automationSequenceRuns.startedAt))
    .limit(1);
  if (!lastRun) return false;

  const [newerInbound] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.dealId, dealId),
        eq(messages.direction, "entrada"),
        gt(messages.createdAt, lastRun.startedAt)
      )
    )
    .limit(1);
  return !newerInbound;
}

// Varredura horária (mesmo cron da Etapa 13, ver /api/cron/task-automation):
// detecta o gatilho 'sem_resposta' e avança os passos de runs vencidos.
export async function runSequenceSweep(): Promise<{
  triggered: number;
  stepsExecuted: number;
}> {
  let triggered = 0;
  let stepsExecuted = 0;

  const noResponseSequences = await db
    .select()
    .from(automationSequences)
    .where(and(eq(automationSequences.active, true), eq(automationSequences.triggerType, "sem_resposta")));

  for (const seq of noResponseSequences) {
    if (seq.noResponseDays == null) continue;
    const dealIds = await findNoResponseDealIds(seq.noResponseDays);

    for (const dealId of dealIds) {
      if (await alreadyFiredSinceLastReply(seq.id, dealId)) continue;
      if (!(await conditionMatches(dealId, seq.conditions as SequenceCondition))) continue;
      await createRun(seq.id, dealId);
      triggered += 1;
    }
  }

  const dueRuns = await db
    .select()
    .from(automationSequenceRuns)
    .where(
      and(eq(automationSequenceRuns.status, "em_andamento"), lte(automationSequenceRuns.nextStepAt, new Date()))
    );

  for (const run of dueRuns) {
    const steps = await db
      .select()
      .from(automationSequenceSteps)
      .where(eq(automationSequenceSteps.sequenceId, run.sequenceId))
      .orderBy(asc(automationSequenceSteps.order));

    const currentIndex = steps.findIndex((s) => s.order === run.currentStepOrder);
    if (currentIndex === -1) {
      await db
        .update(automationSequenceRuns)
        .set({ status: "concluida", nextStepAt: null })
        .where(eq(automationSequenceRuns.id, run.id));
      continue;
    }

    await executeStep(run, steps[currentIndex]);
    stepsExecuted += 1;

    const nextStep = steps[currentIndex + 1];
    if (nextStep) {
      await db
        .update(automationSequenceRuns)
        .set({
          currentStepOrder: nextStep.order,
          nextStepAt: new Date(Date.now() + nextStep.delayMinutes * MS_PER_MINUTE),
        })
        .where(eq(automationSequenceRuns.id, run.id));
    } else {
      await db
        .update(automationSequenceRuns)
        .set({ status: "concluida", nextStepAt: null })
        .where(eq(automationSequenceRuns.id, run.id));
    }
  }

  return { triggered, stepsExecuted };
}
