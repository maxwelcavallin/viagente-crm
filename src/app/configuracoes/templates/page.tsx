import { asc, count, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { customFieldDefinitions, messageTemplates, stageTasks } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildVariableCatalog } from "@/lib/templates";
import { TemplatesList, type TemplateRow } from "./templates-list";
import { TemplateFormDialog } from "./template-form-dialog";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const [templateRows, fieldDefRows] = await Promise.all([
    db
      .select({
        id: messageTemplates.id,
        name: messageTemplates.name,
        content: messageTemplates.content,
        usageCount: count(stageTasks.id),
      })
      .from(messageTemplates)
      .leftJoin(stageTasks, eq(stageTasks.messageTemplateId, messageTemplates.id))
      .groupBy(messageTemplates.id)
      .orderBy(asc(messageTemplates.name)),
    db.select().from(customFieldDefinitions).orderBy(asc(customFieldDefinitions.order)),
  ]);

  const templates: TemplateRow[] = templateRows;

  const variableCatalog = buildVariableCatalog(
    fieldDefRows.map((row) => ({
      key: row.key,
      label: row.label,
      type: row.type,
      options: (row.options as { value: string; label: string }[] | null) ?? null,
      entity: row.entity,
    }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates de mensagem</h1>
        <TemplateFormDialog
          mode="create"
          variableCatalog={variableCatalog}
          trigger={<Button type="button" />}
          triggerLabel={
            <>
              <Plus size={16} strokeWidth={1.75} />
              Novo template
            </>
          }
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Templates cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplatesList templates={templates} variableCatalog={variableCatalog} />
        </CardContent>
      </Card>
    </div>
  );
}
