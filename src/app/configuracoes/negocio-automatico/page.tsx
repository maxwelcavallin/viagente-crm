import { asc } from "drizzle-orm";
import { db } from "@/db";
import { autoDealSettings, pipelines, stages } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoDealSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function AutoDealSettingsPage() {
  const [settingsRows, pipelineRows, stageRows] = await Promise.all([
    db.select().from(autoDealSettings).limit(1),
    db
      .select({ id: pipelines.id, name: pipelines.name })
      .from(pipelines)
      .orderBy(asc(pipelines.order)),
    db
      .select({
        id: stages.id,
        name: stages.name,
        pipelineId: stages.pipelineId,
        order: stages.order,
      })
      .from(stages)
      .orderBy(asc(stages.order)),
  ]);

  const settings = settingsRows[0] ?? null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Negócio automático</h1>
      <p className="text-sm text-muted-foreground">
        Cria um negócio automaticamente quando chega uma conversa nova (WhatsApp ou
        Instagram), numa pipeline/etapa fixa que você escolher abaixo.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
        </CardHeader>
        <CardContent>
          <AutoDealSettingsForm
            settings={
              settings
                ? {
                    active: settings.active,
                    pipelineId: settings.pipelineId,
                    stageId: settings.stageId,
                  }
                : null
            }
            pipelines={pipelineRows}
            stages={stageRows}
          />
        </CardContent>
      </Card>
    </div>
  );
}
