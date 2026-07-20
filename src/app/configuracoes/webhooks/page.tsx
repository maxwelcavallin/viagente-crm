import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { pipelines, stages, tags, webhookConfigs } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WebhooksList } from "./webhooks-list";
import { CreateWebhookDialogs } from "./create-webhook-dialogs";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const [webhookRows, allPipelines, allStages, allTags] = await Promise.all([
    db.select().from(webhookConfigs).orderBy(desc(webhookConfigs.createdAt)),
    db.select({ id: pipelines.id, name: pipelines.name }).from(pipelines).orderBy(asc(pipelines.order)),
    db
      .select({ id: stages.id, name: stages.name, pipelineId: stages.pipelineId, order: stages.order })
      .from(stages)
      .orderBy(asc(stages.order)),
    db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <CreateWebhookDialogs pipelines={allPipelines} stages={allStages} tags={allTags} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Webhooks cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <WebhooksList
            webhooks={webhookRows.map((w) => ({
              id: w.id,
              name: w.name,
              direction: w.direction,
              active: w.active,
              targetUrl: w.targetUrl,
              events: (w.events as string[] | null) ?? [],
              defaultPipelineId: w.defaultPipelineId,
              defaultStageId: w.defaultStageId,
              pipelineId: w.pipelineId,
              stageId: w.stageId,
              tagId: w.tagId,
            }))}
            pipelines={allPipelines}
            stages={allStages}
            tags={allTags}
          />
        </CardContent>
      </Card>
    </div>
  );
}
