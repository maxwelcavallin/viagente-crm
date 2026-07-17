import { randomBytes } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  automationSequences,
  automationSequenceSteps,
  lossReasons,
  pipelineOwnerDistribution,
  pipelines,
  stages,
  stageTasks,
  webhookConfigs,
} from "@/db/schema";

// Clona uma pipeline inteira: etapas, motivos de perda, distribuição de
// dono, tarefas automáticas por etapa, sequências (Etapa 22) com gatilho de
// etapa dentro desta pipeline, e webhooks (Etapa 10) que apontam pra ela —
// só o nome da pipeline muda, tudo abaixo mantém o nome original (são cópias
// de configuração, não itens que o usuário precisa distinguir por nome).
// Webhooks ganham secret_token novo (cada endpoint precisa do seu próprio
// segredo) — a URL muda de qualquer forma porque o id da linha muda, então
// quem usa isso precisa reconfigurar o sistema externo pra apontar pro novo
// endpoint.
export async function clonePipeline(
  sourcePipelineId: string,
  newName: string
): Promise<{ id: string }> {
  const [source] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(eq(pipelines.id, sourcePipelineId))
    .limit(1);
  if (!source) throw new Error("Pipeline não encontrada.");

  const existingPipelines = await db.select({ order: pipelines.order }).from(pipelines);
  const nextOrder =
    existingPipelines.length > 0 ? Math.max(...existingPipelines.map((p) => p.order)) + 1 : 0;

  const [newPipeline] = await db
    .insert(pipelines)
    .values({ name: newName, order: nextOrder })
    .returning({ id: pipelines.id });

  // Etapas — precisa vir primeiro, tudo abaixo referencia stageId.
  const sourceStages = await db
    .select()
    .from(stages)
    .where(eq(stages.pipelineId, sourcePipelineId))
    .orderBy(asc(stages.order));
  const stageIdMap = new Map<string, string>();
  for (const stage of sourceStages) {
    const [newStage] = await db
      .insert(stages)
      .values({
        pipelineId: newPipeline.id,
        name: stage.name,
        order: stage.order,
        color: stage.color,
      })
      .returning({ id: stages.id });
    stageIdMap.set(stage.id, newStage.id);
  }
  const sourceStageIds = sourceStages.map((s) => s.id);
  const mapStageId = (id: string | null): string | null =>
    id ? (stageIdMap.get(id) ?? id) : null;

  // Motivos de perda
  const sourceLossReasons = await db
    .select()
    .from(lossReasons)
    .where(eq(lossReasons.pipelineId, sourcePipelineId));
  if (sourceLossReasons.length > 0) {
    await db.insert(lossReasons).values(
      sourceLossReasons.map((r) => ({
        pipelineId: newPipeline.id,
        label: r.label,
        order: r.order,
      }))
    );
  }

  // Distribuição de dono — pesos mantidos, contador de atribuições reinicia
  // (é histórico de uso da pipeline original, não faz sentido herdar).
  const sourceDistribution = await db
    .select()
    .from(pipelineOwnerDistribution)
    .where(eq(pipelineOwnerDistribution.pipelineId, sourcePipelineId));
  if (sourceDistribution.length > 0) {
    await db.insert(pipelineOwnerDistribution).values(
      sourceDistribution.map((d) => ({
        pipelineId: newPipeline.id,
        userId: d.userId,
        weight: d.weight,
        assignedCount: 0,
      }))
    );
  }

  // Tarefas automáticas por etapa
  const sourceStageTasks =
    sourceStageIds.length > 0
      ? await db.select().from(stageTasks).where(inArray(stageTasks.stageId, sourceStageIds))
      : [];
  if (sourceStageTasks.length > 0) {
    await db.insert(stageTasks).values(
      sourceStageTasks.map((t) => ({
        stageId: stageIdMap.get(t.stageId)!,
        title: t.title,
        type: t.type,
        messageTemplateId: t.messageTemplateId,
        order: t.order,
        daysToComplete: t.daysToComplete,
        triggerDelayMinutes: t.triggerDelayMinutes,
        isAutomatic: t.isAutomatic,
        autoSend: t.autoSend,
        autoSendChannelId: t.autoSendChannelId,
      }))
    );
  }

  // Sequências (Etapa 22) com gatilho de etapa dentro desta pipeline —
  // gatilhos por tag ou "sem resposta" são globais, não pertencem a uma
  // pipeline específica, então não são clonados.
  const sourceSequences =
    sourceStageIds.length > 0
      ? await db
          .select()
          .from(automationSequences)
          .where(inArray(automationSequences.triggerStageId, sourceStageIds))
      : [];
  for (const seq of sourceSequences) {
    const [newSeq] = await db
      .insert(automationSequences)
      .values({
        name: seq.name,
        active: seq.active,
        triggerType: seq.triggerType,
        triggerStageId: mapStageId(seq.triggerStageId),
        triggerTagId: seq.triggerTagId,
        noResponseDays: seq.noResponseDays,
        conditions: seq.conditions,
      })
      .returning({ id: automationSequences.id });

    const sourceSteps = await db
      .select()
      .from(automationSequenceSteps)
      .where(eq(automationSequenceSteps.sequenceId, seq.id))
      .orderBy(asc(automationSequenceSteps.order));
    if (sourceSteps.length > 0) {
      await db.insert(automationSequenceSteps).values(
        sourceSteps.map((step) => ({
          sequenceId: newSeq.id,
          order: step.order,
          delayMinutes: step.delayMinutes,
          type: step.type,
          title: step.title,
          messageTemplateId: step.messageTemplateId,
          autoSend: step.autoSend,
          autoSendChannelId: step.autoSendChannelId,
          addTagId: step.addTagId,
          moveToStageId: mapStageId(step.moveToStageId),
        }))
      );
    }
  }

  // Webhooks (Etapa 10) — entrada aponta via defaultPipelineId/
  // defaultStageId, saída via pipelineId/stageId; uma linha nunca preenche
  // os dois pares, então as duas queries não se sobrepõem.
  const inboundWebhooks = await db
    .select()
    .from(webhookConfigs)
    .where(eq(webhookConfigs.defaultPipelineId, sourcePipelineId));
  for (const wh of inboundWebhooks) {
    await db.insert(webhookConfigs).values({
      name: wh.name,
      direction: wh.direction,
      sourcePlatform: wh.sourcePlatform,
      active: wh.active,
      secretToken: wh.secretToken ? randomBytes(24).toString("hex") : null,
      fieldMapping: wh.fieldMapping,
      contactTagIds: wh.contactTagIds,
      dealTagIds: wh.dealTagIds,
      defaultPipelineId: newPipeline.id,
      defaultStageId: mapStageId(wh.defaultStageId),
    });
  }

  const outboundWebhooks = await db
    .select()
    .from(webhookConfigs)
    .where(eq(webhookConfigs.pipelineId, sourcePipelineId));
  for (const wh of outboundWebhooks) {
    await db.insert(webhookConfigs).values({
      name: wh.name,
      direction: wh.direction,
      active: wh.active,
      targetUrl: wh.targetUrl,
      events: wh.events,
      fieldMapping: wh.fieldMapping,
      contactTagIds: wh.contactTagIds,
      dealTagIds: wh.dealTagIds,
      pipelineId: newPipeline.id,
      stageId: mapStageId(wh.stageId),
    });
  }

  return { id: newPipeline.id };
}
