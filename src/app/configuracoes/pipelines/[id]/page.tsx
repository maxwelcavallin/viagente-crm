import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  customFieldDefinitions,
  emailTemplates,
  lossReasons,
  messageTemplateItems,
  messageTemplates,
  pipelineOwnerDistribution,
  pipelines,
  stages,
  stageTasks,
  users,
  whatsappChannels,
} from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildVariableCatalog } from "@/lib/templates";
import type { TemplateData } from "@/app/configuracoes/templates/template-form-dialog";
import { StagesList } from "./stages-list";
import { CreateStageForm } from "./create-stage-form";
import { LossReasonsPanel } from "./loss-reasons-panel";
import { OwnerDistributionPanel } from "./owner-distribution-panel";
import type { StageTask } from "./stage-tasks-panel";

export default async function PipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [pipeline] = await db
    .select({ id: pipelines.id, name: pipelines.name })
    .from(pipelines)
    .where(eq(pipelines.id, id))
    .limit(1);

  if (!pipeline) notFound();

  const pipelineStages = await db
    .select({ id: stages.id, name: stages.name, color: stages.color })
    .from(stages)
    .where(eq(stages.pipelineId, id))
    .orderBy(asc(stages.order));

  const stageIds = pipelineStages.map((s) => s.id);
  const [
    stageTaskRows,
    templateRows,
    templateItemRows,
    emailTemplateOptions,
    channels,
    pipelineLossReasons,
    distributionRows,
    allUsers,
    fieldDefRows,
  ] = await Promise.all([
    stageIds.length > 0
      ? db
          .select({
            id: stageTasks.id,
            stageId: stageTasks.stageId,
            title: stageTasks.title,
            type: stageTasks.type,
            messageTemplateId: stageTasks.messageTemplateId,
            emailTemplateId: stageTasks.emailTemplateId,
            order: stageTasks.order,
            daysToComplete: stageTasks.daysToComplete,
            triggerDelayMinutes: stageTasks.triggerDelayMinutes,
            isAutomatic: stageTasks.isAutomatic,
            autoSend: stageTasks.autoSend,
            autoSendChannelId: stageTasks.autoSendChannelId,
          })
          .from(stageTasks)
          .where(inArray(stageTasks.stageId, stageIds))
          .orderBy(asc(stageTasks.order))
      : Promise.resolve([]),
    db.select({ id: messageTemplates.id, name: messageTemplates.name }).from(messageTemplates),
    db
      .select({
        id: messageTemplateItems.id,
        templateId: messageTemplateItems.templateId,
        order: messageTemplateItems.order,
        content: messageTemplateItems.content,
        mediaType: messageTemplateItems.mediaType,
        mediaFileName: messageTemplateItems.mediaFileName,
      })
      .from(messageTemplateItems)
      .orderBy(asc(messageTemplateItems.order)),
    db.select({ id: emailTemplates.id, name: emailTemplates.name }).from(emailTemplates),
    db.select({ id: whatsappChannels.id, label: whatsappChannels.label }).from(whatsappChannels),
    db
      .select({ id: lossReasons.id, label: lossReasons.label })
      .from(lossReasons)
      .where(eq(lossReasons.pipelineId, id))
      .orderBy(asc(lossReasons.order)),
    db
      .select({
        id: pipelineOwnerDistribution.id,
        userId: pipelineOwnerDistribution.userId,
        userName: users.name,
        weight: pipelineOwnerDistribution.weight,
        assignedCount: pipelineOwnerDistribution.assignedCount,
      })
      .from(pipelineOwnerDistribution)
      .innerJoin(users, eq(users.id, pipelineOwnerDistribution.userId))
      .where(eq(pipelineOwnerDistribution.pipelineId, id))
      .orderBy(asc(pipelineOwnerDistribution.createdAt)),
    db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name)),
    db.select().from(customFieldDefinitions).orderBy(asc(customFieldDefinitions.order)),
  ]);

  const itemsByTemplateId = new Map<string, typeof templateItemRows>();
  for (const item of templateItemRows) {
    const list = itemsByTemplateId.get(item.templateId) ?? [];
    list.push(item);
    itemsByTemplateId.set(item.templateId, list);
  }
  const templates: TemplateData[] = templateRows.map((row) => ({
    id: row.id,
    name: row.name,
    items: (itemsByTemplateId.get(row.id) ?? []).map((it) => ({
      id: it.id,
      content: it.content,
      mediaType: it.mediaType,
      mediaFileName: it.mediaFileName,
    })),
  }));

  const variableCatalog = buildVariableCatalog(
    fieldDefRows.map((row) => ({
      key: row.key,
      label: row.label,
      type: row.type,
      options: (row.options as { value: string; label: string }[] | null) ?? null,
      entity: row.entity,
    }))
  );

  const stageTasksByStageId: Record<string, StageTask[]> = {};
  for (const row of stageTaskRows) {
    const list = stageTasksByStageId[row.stageId] ?? [];
    list.push({
      id: row.id,
      title: row.title,
      type: row.type,
      messageTemplateId: row.messageTemplateId,
      emailTemplateId: row.emailTemplateId,
      daysToComplete: row.daysToComplete,
      triggerDelayMinutes: row.triggerDelayMinutes,
      isAutomatic: row.isAutomatic,
      autoSend: row.autoSend,
      autoSendChannelId: row.autoSendChannelId,
    });
    stageTasksByStageId[row.stageId] = list;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/configuracoes/pipelines"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Pipelines
        </Link>
        <h1 className="text-2xl font-bold">{pipeline.name}</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Etapas</CardTitle>
          </CardHeader>
          <CardContent>
            <StagesList
              key={pipelineStages.map((s) => s.id).join(",")}
              stages={pipelineStages}
              pipelineId={pipeline.id}
              stageTasksByStageId={stageTasksByStageId}
              templates={templates}
              variableCatalog={variableCatalog}
              emailTemplates={emailTemplateOptions}
              channels={channels}
            />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nova etapa</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateStageForm pipelineId={pipeline.id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Motivos de perda</CardTitle>
            </CardHeader>
            <CardContent>
              <LossReasonsPanel pipelineId={pipeline.id} reasons={pipelineLossReasons} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de donos</CardTitle>
            </CardHeader>
            <CardContent>
              <OwnerDistributionPanel
                pipelineId={pipeline.id}
                rows={distributionRows}
                availableUsers={allUsers}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
