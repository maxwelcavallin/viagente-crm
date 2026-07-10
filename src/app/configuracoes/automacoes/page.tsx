import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messageTemplates, tagAutomations, tags, whatsappChannels } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutomationsList, type TagAutomationRow } from "./automations-list";

export const dynamic = "force-dynamic";

export default async function AutomacoesPage() {
  const [rows, allTags, templates, channels] = await Promise.all([
    db
      .select({
        id: tagAutomations.id,
        tagId: tagAutomations.tagId,
        tagName: tags.name,
        tagColor: tags.color,
        trigger: tagAutomations.trigger,
        delayMinutes: tagAutomations.delayMinutes,
        title: tagAutomations.title,
        type: tagAutomations.type,
        messageTemplateId: tagAutomations.messageTemplateId,
        autoSend: tagAutomations.autoSend,
        autoSendChannelId: tagAutomations.autoSendChannelId,
      })
      .from(tagAutomations)
      .innerJoin(tags, eq(tagAutomations.tagId, tags.id))
      .orderBy(asc(tags.name)),
    db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).orderBy(asc(tags.name)),
    db.select({ id: messageTemplates.id, name: messageTemplates.name }).from(messageTemplates),
    db.select({ id: whatsappChannels.id, label: whatsappChannels.label }).from(whatsappChannels),
  ]);

  const automations: TagAutomationRow[] = rows;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Automações</h1>
        <p className="text-sm text-muted-foreground">
          Tarefas disparadas sozinhas quando uma tag é adicionada a um negócio, ou depois de
          um número de dias com a tag. O gatilho por etapa (entrada na etapa / dias na etapa)
          continua em Pipelines e Etapas &gt; editar etapa.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Automações por tag</CardTitle>
        </CardHeader>
        <CardContent>
          <AutomationsList
            automations={automations}
            allTags={allTags}
            templates={templates}
            channels={channels}
          />
        </CardContent>
      </Card>
    </div>
  );
}
