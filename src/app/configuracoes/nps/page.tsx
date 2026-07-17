import { asc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { messageTemplates, npsSettings, pipelines, stages, whatsappChannels } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NpsSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function NpsSettingsPage() {
  const [settingsRows, pipelineRows, stageRows, channelRows, templateRows] =
    await Promise.all([
      db.select().from(npsSettings).limit(1),
      db.select({ id: pipelines.id, name: pipelines.name }).from(pipelines).orderBy(asc(pipelines.order)),
      db
        .select({ id: stages.id, name: stages.name, pipelineId: stages.pipelineId })
        .from(stages)
        .orderBy(asc(stages.order)),
      db
        .select({ id: whatsappChannels.id, label: whatsappChannels.label })
        .from(whatsappChannels),
      db.select({ id: messageTemplates.id, name: messageTemplates.name }).from(messageTemplates),
    ]);

  const settings = settingsRows[0] ?? null;
  const pipelineById = new Map(pipelineRows.map((p) => [p.id, p.name]));
  const stageOptions = stageRows.map((s) => ({
    id: s.id,
    label: `${pipelineById.get(s.pipelineId) ?? "?"} → ${s.name}`,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pós-venda / NPS</h1>
      <p className="text-sm text-muted-foreground">
        O indicador de NPS (nota média, distribuição e respostas recentes) aparece no dashboard da{" "}
        <Link href="/" className="text-primary hover:underline">
          Início
        </Link>
        .
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Configuração do envio automático</CardTitle>
        </CardHeader>
        <CardContent>
          <NpsSettingsForm
            settings={
              settings
                ? {
                    active: settings.active,
                    triggerStageId: settings.triggerStageId,
                    triggerOnWon: settings.triggerOnWon,
                    delayDays: settings.delayDays,
                    channelId: settings.channelId,
                    messageTemplateId: settings.messageTemplateId,
                  }
                : null
            }
            stages={stageOptions}
            channels={channelRows}
            templates={templateRows}
          />
        </CardContent>
      </Card>
    </div>
  );
}
