import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pipelines, stages } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StagesList } from "./stages-list";
import { CreateStageForm } from "./create-stage-form";

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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/pipelines"
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
