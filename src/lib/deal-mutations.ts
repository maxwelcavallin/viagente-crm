import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { deals, stageTasks, stages, tasks } from "@/db/schema";
import { fireEtapaSequenceTriggers } from "@/lib/automation-sequences";
import { logDealActivity, type DealActivitySource } from "@/lib/deal-activity-log";
import { maybeAutoSendTask } from "@/lib/task-automation";
import { dispatchOutboundWebhooks } from "@/lib/webhook-outbound";

export type MutationActor = { userId: string | null; source: DealActivitySource };

// Núcleo de "mover negócio de etapa", extraído de moveDealStageAction
// (negocios/actions.ts) pra ser chamado tanto pela action "use server" da UI
// (actor manual, com requireSession()) quanto pela API pública/MCP da Etapa
// 28 (actor 'api', autenticado por api_key) — sem duplicar a criação de
// tarefas automáticas da etapa (Etapa 9) e o disparo de sequências (Etapa
// 22) em dois lugares. NÃO usado por automation-sequences.ts: o passo
// 'mudar_etapa' de uma sequência já tinha comportamento mais simples (só
// move, sem recriar stage_tasks nem disparar novas sequências) antes da
// Etapa 28 — unificar mudaria esse comportamento existente, fora de escopo.
export async function moveDealStage(
  dealId: string,
  stageId: string,
  actor: MutationActor
): Promise<{ ok: boolean }> {
  const [previous] = await db
    .select({ stageId: deals.stageId })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (!previous) return { ok: false };

  await db
    .update(deals)
    .set({ stageId, updatedAt: new Date(), stageEnteredAt: new Date() })
    .where(eq(deals.id, dealId));

  if (previous.stageId !== stageId) {
    const stageRows = await db
      .select({ id: stages.id, name: stages.name })
      .from(stages)
      .where(inArray(stages.id, [previous.stageId, stageId]));
    const nameOf = (sid: string) => stageRows.find((s) => s.id === sid)?.name ?? "—";
    await logDealActivity({
      dealId,
      userId: actor.userId,
      source: actor.source,
      action: "etapa_alterada",
      fieldName: "Etapa",
      oldValue: nameOf(previous.stageId),
      newValue: nameOf(stageId),
    });
  }

  // Cria as tarefas automáticas da etapa de destino (Etapa 9). Só as
  // marcadas isAutomatic=true — as demais ficam como modelo disponível pra
  // adicionar manualmente (ver addStageTaskToDealAction). Se o negócio já
  // visitou essa etapa antes, cria de novo — não reaproveita tarefas antigas
  // já concluídas (regra explícita do critério de aceite). Tarefas com
  // triggerDelayMinutes setado NÃO entram aqui — ficam pro cron de automação
  // varrer quando o tempo configurado na etapa for atingido.
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
        isNull(stageTasks.triggerDelayMinutes)
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

  await fireEtapaSequenceTriggers(dealId, stageId);
  void dispatchOutboundWebhooks("etapa_alterada", dealId);

  revalidatePath("/negocios");
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}
