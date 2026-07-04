import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { pipelines, stages } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreatePipelineForm } from "./create-pipeline-form";

export default async function PipelinesPage() {
  const allPipelines = await db
    .select({
      id: pipelines.id,
      name: pipelines.name,
      stageCount: count(stages.id),
    })
    .from(pipelines)
    .leftJoin(stages, eq(stages.pipelineId, pipelines.id))
    .groupBy(pipelines.id, pipelines.name, pipelines.order)
    .orderBy(pipelines.order);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Pipelines</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pipelines cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            {allPipelines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma pipeline cadastrada ainda.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Etapas</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPipelines.map((pipeline) => (
                    <TableRow key={pipeline.id}>
                      <TableCell>{pipeline.name}</TableCell>
                      <TableCell>{pipeline.stageCount}</TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/pipelines/${pipeline.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          Ver etapas
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Nova pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <CreatePipelineForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
