import { redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  contacts,
  customFieldDefinitions,
  deals,
  emailTemplates,
  messageTemplates,
  pipelines,
  stageTasks,
  tasks,
  users,
  whatsappChannels,
} from "@/db/schema";
import { getAllowedChannelIds } from "@/lib/channel-access";
import { formatCustomFieldValue } from "@/lib/custom-fields";
import { formatCurrencyBRL } from "@/lib/deal-format";
import { resolveConnectionOwner } from "@/lib/google-calendar";
import { substituteTemplate } from "@/lib/templates";
import { TarefasList, type TarefaItem } from "./tarefas-list";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [
    taskRows,
    dealFieldDefRows,
    contactFieldDefRows,
    allowedChannelIds,
    googleConnectionOwner,
    allUsers,
    allPipelines,
  ] = await Promise.all([
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          type: tasks.type,
          status: tasks.status,
          dueAt: tasks.dueAt,
          templateContent: messageTemplates.content,
          emailTemplateSubject: emailTemplates.subject,
          emailTemplateContent: emailTemplates.content,
          dealId: deals.id,
          dealTitle: deals.title,
          dealCustomFields: deals.customFields,
          dealValue: deals.value,
          dealOwnerId: deals.ownerId,
          pipelineId: deals.pipelineId,
          pipelineName: pipelines.name,
          contactId: contacts.id,
          contactName: contacts.name,
          contactEmail: contacts.email,
          contactCustomFields: contacts.customFields,
        })
        .from(tasks)
        .innerJoin(deals, eq(tasks.dealId, deals.id))
        .innerJoin(contacts, eq(deals.contactId, contacts.id))
        .innerJoin(pipelines, eq(deals.pipelineId, pipelines.id))
        .leftJoin(stageTasks, eq(tasks.stageTaskId, stageTasks.id))
        .leftJoin(messageTemplates, eq(stageTasks.messageTemplateId, messageTemplates.id))
        .leftJoin(emailTemplates, eq(stageTasks.emailTemplateId, emailTemplates.id)),
      db
        .select()
        .from(customFieldDefinitions)
        .where(eq(customFieldDefinitions.entity, "deal"))
        .orderBy(asc(customFieldDefinitions.order)),
      db
        .select()
        .from(customFieldDefinitions)
        .where(eq(customFieldDefinitions.entity, "contact"))
        .orderBy(asc(customFieldDefinitions.order)),
      getAllowedChannelIds(session.user.id, session.user.role),
      resolveConnectionOwner(session.user.id),
      db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name)),
      db.select({ id: pipelines.id, name: pipelines.name }).from(pipelines).orderBy(asc(pipelines.order)),
    ]);

  const isGoogleConnected = googleConnectionOwner != null;

  const allowedChannels =
    allowedChannelIds.length > 0
      ? await db
          .select({
            id: whatsappChannels.id,
            label: whatsappChannels.label,
            isDefault: whatsappChannels.isDefault,
          })
          .from(whatsappChannels)
          .where(inArray(whatsappChannels.id, allowedChannelIds))
      : [];

  const dealFieldDefinitions = dealFieldDefRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));
  const contactFieldDefinitions = contactFieldDefRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));

  const items: TarefaItem[] = taskRows.map((row) => {
    const dealCustomFields = (row.dealCustomFields as Record<string, unknown>) ?? {};
    const contactCustomFields = (row.contactCustomFields as Record<string, unknown>) ?? {};

    const variableValues: Record<string, string> = {
      nome_contato: row.contactName,
      email_contato: row.contactEmail ?? "",
      valor: formatCurrencyBRL(row.dealValue) ?? "",
    };
    for (const def of dealFieldDefinitions) {
      if (dealCustomFields[def.key] != null) {
        variableValues[def.key] = formatCustomFieldValue(def, dealCustomFields[def.key]);
      }
    }
    for (const def of contactFieldDefinitions) {
      if (contactCustomFields[def.key] != null) {
        variableValues[def.key] = formatCustomFieldValue(def, contactCustomFields[def.key]);
      }
    }

    return {
      id: row.id,
      title: row.title,
      type: row.type,
      status: row.status,
      dueAt: row.dueAt ? row.dueAt.toISOString() : null,
      messagePreview: row.templateContent
        ? substituteTemplate(row.templateContent, variableValues)
        : row.emailTemplateContent
          ? substituteTemplate(row.emailTemplateContent, variableValues)
          : null,
      emailSubjectPreview: row.emailTemplateSubject
        ? substituteTemplate(row.emailTemplateSubject, variableValues)
        : null,
      dealId: row.dealId,
      dealTitle: row.dealTitle,
      dealOwnerId: row.dealOwnerId,
      pipelineId: row.pipelineId,
      pipelineName: row.pipelineName,
      contactId: row.contactId,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
    };
  });

  const defaultChannel = allowedChannels.find((c) => c.isDefault);
  const preselectedChannelId = defaultChannel?.id ?? allowedChannels[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Tarefas</h1>
        <p className="text-sm text-muted-foreground">
          Tarefas de todos os negócios — automáticas da pipeline ou criadas manualmente.
        </p>
      </div>
      <TarefasList
        tasks={items}
        channels={allowedChannels.map((c) => ({ id: c.id, label: c.label }))}
        preselectedChannelId={preselectedChannelId}
        isGoogleConnected={isGoogleConnected}
        currentUserId={session.user.id}
        users={allUsers}
        pipelines={allPipelines}
      />
    </div>
  );
}
