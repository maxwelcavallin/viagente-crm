import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customFieldDefinitions, pipelines, stages, users } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Upload } from "lucide-react";
import { ImportWizard } from "./import-wizard";
import { getRecentImportLogs } from "./actions";

export const dynamic = "force-dynamic";

export default async function ImportacaoPage() {
  const [allPipelines, allStages, contactFieldRows, dealFieldRows, recentImports, userRows] =
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
      getRecentImportLogs(),
      db.select({ id: users.id, name: users.name }).from(users),
    ]);

  const contactFieldDefs = contactFieldRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));
  const dealFieldDefs = dealFieldRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));

  const userNameById = new Map(userRows.map((u) => [u.id, u.name]));
  const pipelineNameById = new Map(allPipelines.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Importação de Dados</h1>

      <ImportWizard
        pipelines={allPipelines}
        stages={allStages}
        contactFieldDefs={contactFieldDefs}
        dealFieldDefs={dealFieldDefs}
      />

      <Card>
        <CardHeader>
          <CardTitle>Importações anteriores</CardTitle>
        </CardHeader>
        <CardContent>
          {recentImports.length === 0 ? (
            <EmptyState
              icon={Upload}
              title="Nenhuma importação ainda"
              description="O histórico das últimas importações aparece aqui."
            />
          ) : (
            <div className="space-y-2">
              {recentImports.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border p-3 text-sm"
                >
                  <span className="font-medium">{log.fileName}</span>
                  <span className="text-muted-foreground">
                    {log.createdAt.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-muted-foreground">
                    {log.createdBy ? userNameById.get(log.createdBy) ?? "—" : "—"}
                  </span>
                  {log.pipelineId && (
                    <span className="text-muted-foreground">
                      → {pipelineNameById.get(log.pipelineId) ?? "—"}
                    </span>
                  )}
                  <span className="text-status-success">{log.contactsCreated} contatos criados</span>
                  <span className="text-muted-foreground">{log.contactsUpdated} atualizados</span>
                  <span className="text-muted-foreground">{log.dealsCreated} negócios criados</span>
                  {log.errorCount > 0 && (
                    <span className="text-destructive">{log.errorCount} erro(s)</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
