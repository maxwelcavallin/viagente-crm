import { asc, count, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import {
  customFieldDefinitions,
  emailTemplates,
  messageTemplateItems,
  messageTemplates,
  stageTasks,
} from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildVariableCatalog } from "@/lib/templates";
import { TemplatesList, type TemplateRow } from "./templates-list";
import { TemplateFormDialog } from "./template-form-dialog";
import { EmailTemplatesList, type EmailTemplateRow } from "./email-templates-list";
import { EmailTemplateFormDialog } from "./email-template-form-dialog";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const [templateRows, itemRows, emailTemplateRows, fieldDefRows] = await Promise.all([
    db
      .select({
        id: messageTemplates.id,
        name: messageTemplates.name,
        usageCount: count(stageTasks.id),
      })
      .from(messageTemplates)
      .leftJoin(stageTasks, eq(stageTasks.messageTemplateId, messageTemplates.id))
      .groupBy(messageTemplates.id)
      .orderBy(asc(messageTemplates.name)),
    db
      .select({
        id: messageTemplateItems.id,
        templateId: messageTemplateItems.templateId,
        order: messageTemplateItems.order,
        content: messageTemplateItems.content,
        mediaType: messageTemplateItems.mediaType,
        mediaFileName: messageTemplateItems.mediaFileName,
      })
      .from(messageTemplateItems)
      .orderBy(asc(messageTemplateItems.order)),
    db
      .select({
        id: emailTemplates.id,
        name: emailTemplates.name,
        subject: emailTemplates.subject,
        content: emailTemplates.content,
        usageCount: count(stageTasks.id),
      })
      .from(emailTemplates)
      .leftJoin(stageTasks, eq(stageTasks.emailTemplateId, emailTemplates.id))
      .groupBy(emailTemplates.id)
      .orderBy(asc(emailTemplates.name)),
    db.select().from(customFieldDefinitions).orderBy(asc(customFieldDefinitions.order)),
  ]);

  const itemsByTemplateId = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const list = itemsByTemplateId.get(item.templateId) ?? [];
    list.push(item);
    itemsByTemplateId.set(item.templateId, list);
  }

  const templates: TemplateRow[] = templateRows.map((row) => ({
    id: row.id,
    name: row.name,
    usageCount: row.usageCount,
    items: (itemsByTemplateId.get(row.id) ?? []).map((it) => ({
      id: it.id,
      content: it.content,
      mediaType: it.mediaType,
      mediaFileName: it.mediaFileName,
    })),
  }));
  const emailTemplateList: EmailTemplateRow[] = emailTemplateRows;

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

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Templates de email</h2>
        <EmailTemplateFormDialog
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
          <CardTitle>Templates de email cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <EmailTemplatesList templates={emailTemplateList} variableCatalog={variableCatalog} />
        </CardContent>
      </Card>
    </div>
  );
}
