import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  automationSequenceSteps,
  automationSequences,
  customFieldDefinitions,
  messageTemplates,
  pipelines,
  stages,
  tags,
  whatsappChannels,
} from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SequencesList, type SequenceRow } from "./sequences-list";

export const dynamic = "force-dynamic";

export default async function SequenciasPage() {
  const [sequenceRows, stepRows, stageRows, allTags, templates, channels, dealFieldDefRows] =
    await Promise.all([
      db.select().from(automationSequences).orderBy(asc(automationSequences.createdAt)),
      db.select().from(automationSequenceSteps).orderBy(asc(automationSequenceSteps.order)),
      db
        .select({
          id: stages.id,
          name: stages.name,
          pipelineId: stages.pipelineId,
          pipelineName: pipelines.name,
        })
        .from(stages)
        .innerJoin(pipelines, eq(stages.pipelineId, pipelines.id))
        .orderBy(asc(pipelines.order), asc(stages.order)),
      db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),
      db.select({ id: messageTemplates.id, name: messageTemplates.name }).from(messageTemplates),
      db.select({ id: whatsappChannels.id, label: whatsappChannels.label }).from(whatsappChannels),
      db
        .select()
        .from(customFieldDefinitions)
        .where(eq(customFieldDefinitions.entity, "deal"))
        .orderBy(asc(customFieldDefinitions.order)),
    ]);

  const stepsBySequence = new Map<string, typeof stepRows>();
  for (const step of stepRows) {
    const list = stepsBySequence.get(step.sequenceId) ?? [];
    list.push(step);
    stepsBySequence.set(step.sequenceId, list);
  }

  const sequences: SequenceRow[] = sequenceRows.map((seq) => ({
    id: seq.id,
    name: seq.name,
    active: seq.active,
    triggerType: seq.triggerType,
    triggerStageId: seq.triggerStageId,
    triggerTagId: seq.triggerTagId,
    noResponseDays: seq.noResponseDays,
    conditions: seq.conditions,
    steps: (stepsBySequence.get(seq.id) ?? []).map((s) => ({
      id: s.id,
      order: s.order,
      delayMinutes: s.delayMinutes,
      type: s.type,
      title: s.title,
      messageTemplateId: s.messageTemplateId,
      autoSend: s.autoSend,
      autoSendChannelId: s.autoSendChannelId,
      addTagId: s.addTagId,
      moveToStageId: s.moveToStageId,
    })),
  }));

  const dealFieldDefinitions = dealFieldDefRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Sequências de automação</h1>
        <p className="text-sm text-muted-foreground">
          Sequências de múltiplos passos disparadas por etapa, tag, ou falta de resposta do
          contato — com condição opcional sobre o negócio. Automações de passo único continuam em
          Automações e em Pipelines e Etapas.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sequências cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          <SequencesList
            sequences={sequences}
            stages={stageRows}
            allTags={allTags}
            templates={templates}
            channels={channels}
            dealFieldDefinitions={dealFieldDefinitions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
