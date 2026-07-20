import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import {
  customFieldDefinitions,
  pipelines,
  stages,
  tags,
  webhookConfigs,
  webhookLogs,
} from "@/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FieldDef } from "@/lib/custom-fields";
import type { TagOption } from "@/lib/tags";
import { FieldMappingEditor } from "./field-mapping-editor";
import { WebhookTagsEditor } from "./webhook-tags-editor";
import { TestPayloadPanel } from "./test-payload-panel";
import { LogsList, type LogRow } from "./logs-list";
import { EditOutboundForm } from "./edit-outbound-form";
import { EditInboundForm } from "./edit-inbound-form";
import { DeleteWebhookDialog } from "./delete-webhook-dialog";

export const dynamic = "force-dynamic";

export default async function WebhookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [webhook] = await db
    .select()
    .from(webhookConfigs)
    .where(eq(webhookConfigs.id, id))
    .limit(1);
  if (!webhook) notFound();

  const baseUrl = await getBaseUrl();
  const inboundUrl = `${baseUrl}/api/webhooks/inbound/${webhook.id}`;

  const [allPipelines, allStages, contactFieldRows, dealFieldRows, logRows, allTagRows] =
    await Promise.all([
      db.select({ id: pipelines.id, name: pipelines.name }).from(pipelines).orderBy(asc(pipelines.order)),
      db
        .select({ id: stages.id, name: stages.name, pipelineId: stages.pipelineId, order: stages.order })
        .from(stages)
        .orderBy(asc(stages.order)),
      db
        .select()
        .from(customFieldDefinitions)
        .where(eq(customFieldDefinitions.entity, "contact"))
        .orderBy(asc(customFieldDefinitions.order)),
      db
        .select()
        .from(customFieldDefinitions)
        .where(eq(customFieldDefinitions.entity, "deal"))
        .orderBy(asc(customFieldDefinitions.order)),
      db
        .select()
        .from(webhookLogs)
        .where(eq(webhookLogs.webhookConfigId, id))
        .orderBy(desc(webhookLogs.createdAt))
        .limit(50),
      db.select().from(tags).orderBy(asc(tags.name)),
    ]);

  const allTags: TagOption[] = allTagRows.map((t) => ({ id: t.id, name: t.name, color: t.color }));

  const toFieldDef = (row: (typeof contactFieldRows)[number]): FieldDef => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  });

  const logs: LogRow[] = logRows.map((row) => ({
    id: row.id,
    status: row.status,
    errorMessage: row.errorMessage,
    payload: row.payload,
    createdAt: row.createdAt,
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/configuracoes/webhooks"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} strokeWidth={1.75} />
        Webhooks
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{webhook.name}</h1>
          <Badge variant={webhook.direction === "entrada" ? "info" : "secondary"}>
            {webhook.direction === "entrada" ? "Entrada" : "Saída"}
          </Badge>
        </div>
        <DeleteWebhookDialog webhook={webhook} redirectTo="/configuracoes/webhooks" />
      </div>

      {webhook.direction === "entrada" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Configuração</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-muted p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">URL:</span>{" "}
                  <code className="font-mono text-xs break-all">{inboundUrl}</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Autentique com o header <code>x-webhook-secret</code> ou o
                  query param <code>?token=</code> usando o token gerado na
                  criação (não fica visível de novo aqui).
                </p>
              </div>
              <EditInboundForm
                webhook={{
                  id: webhook.id,
                  name: webhook.name,
                  defaultPipelineId: webhook.defaultPipelineId,
                  defaultStageId: webhook.defaultStageId,
                }}
                pipelines={allPipelines}
                stages={allStages}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mapeamento de campos</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldMappingEditor
                webhookId={webhook.id}
                initialMapping={(webhook.fieldMapping as Record<string, string>) ?? {}}
                contactFieldDefs={contactFieldRows.map(toFieldDef)}
                dealFieldDefs={dealFieldRows.map(toFieldDef)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <WebhookTagsEditor
                webhookId={webhook.id}
                allTags={allTags}
                initialContactTagIds={(webhook.contactTagIds as string[]) ?? []}
                initialDealTagIds={(webhook.dealTagIds as string[]) ?? []}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enviar payload de teste</CardTitle>
            </CardHeader>
            <CardContent>
              <TestPayloadPanel webhookId={webhook.id} />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
          </CardHeader>
          <CardContent>
            <EditOutboundForm
              webhook={{
                id: webhook.id,
                name: webhook.name,
                targetUrl: webhook.targetUrl,
                events: (webhook.events as string[] | null) ?? [],
                pipelineId: webhook.pipelineId,
                stageId: webhook.stageId,
                tagId: webhook.tagId,
              }}
              pipelines={allPipelines}
              stages={allStages}
              tags={allTags}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Execuções</CardTitle>
        </CardHeader>
        <CardContent>
          <LogsList logs={logs} />
        </CardContent>
      </Card>
    </div>
  );
}
