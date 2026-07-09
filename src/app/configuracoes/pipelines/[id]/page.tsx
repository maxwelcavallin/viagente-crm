import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { messageTemplates, pipelines, stages, stageTasks } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StagesList } from "./stages-list";
import { CreateStageForm } from "./create-stage-form";
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
  const [stageTaskRows, templates] = await Promise.all([
    stageIds.length > 0
      ? db
          .select({
            id: stageTasks.id,
            stageId: stageTasks.stageId,
            title: stageTasks.title,
            type: stageTasks.type,
            messageTemplateId: stageTasks.messageTemplateId,
            order: stageTasks.order,
            daysToComplete: stageTasks.daysToComplete,
            isAutomatic: stageTasks.isAutomatic,
          })
          .from(stageTasks)
          .where(inArray(stageTasks.stageId, stageIds))
          .orderBy(asc(stageTasks.order))
      : Promise.resolve([]),
    db.select({ id: messageTemplates.id, name: messageTemplates.name }).from(messageTemplates),
  ]);

  const stageTasksByStageId: Record<string, StageTask[]> = {};
  for (const row of stageTaskRows) {
    const list = stageTasksByStageId[row.stageId] ?? [];
    list.push({
      id: row.id,
      title: row.title,
      type: row.type,
      messageTemplateId: row.messageTemplateId,
      daysToComplete: row.daysToComplete,
      isAutomatic: row.isAutomatic,
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
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Nova etapa</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateStageForm pipelineId={pipeline.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
