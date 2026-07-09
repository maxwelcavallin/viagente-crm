import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  contactTags,
  contacts,
  customFieldDefinitions,
  dealTags,
  deals,
  messageTemplates,
  pipelines,
  stages,
  stageTasks,
  tags,
  tasks,
  users,
  whatsappChannels,
} from "@/db/schema";
import { getAllowedChannelIds } from "@/lib/channel-access";
import { getThread } from "@/lib/conversations";
import { formatCustomFieldValue, type FieldDef } from "@/lib/custom-fields";
import { formatCurrencyBRL } from "@/lib/deal-format";
import { resolveConnectionOwner } from "@/lib/google-calendar";
import { getPendingScheduledMessages } from "@/lib/scheduled-messages";
import { substituteTemplate } from "@/lib/templates";
import { TEMPERATURE_BADGE_VARIANT, TEMPERATURE_LABELS } from "@/lib/temperature";
import type { TagOption } from "@/lib/tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageList } from "@/components/message-list";
import { ScheduleMessageDialog } from "@/components/schedule-message-dialog";
import { ScheduledMessagesList } from "@/components/scheduled-messages-list";
import { ScheduleMeetingDialog } from "@/components/schedule-meeting-dialog";
import { ContactFormDialog } from "@/app/contatos/contact-form-dialog";
import { DealFormDialog } from "../deal-form-dialog";
import { DeleteDealDialog } from "../delete-deal-dialog";
import { DealStatusActions } from "./deal-status-actions";
import { DealTasksPanel, type DealTask, type ManualStageTask } from "./deal-tasks-panel";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const [deal] = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  if (!deal) notFound();

  const [
    contact,
    pipeline,
    stage,
    owner,
    allPipelines,
    allStages,
    allTagRows,
    dealTagRows,
    contactRows,
    ownerRows,
    fieldDefRows,
    allowedChannelIds,
  ] = await Promise.all([
    db
      .select()
      .from(contacts)
      .where(eq(contacts.id, deal.contactId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ id: pipelines.id, name: pipelines.name })
      .from(pipelines)
      .where(eq(pipelines.id, deal.pipelineId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ id: stages.id, name: stages.name })
      .from(stages)
      .where(eq(stages.id, deal.stageId))
      .limit(1)
      .then((r) => r[0]),
    deal.ownerId
      ? db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, deal.ownerId))
          .limit(1)
          .then((r) => r[0])
      : Promise.resolve(undefined),
    db.select().from(pipelines).orderBy(asc(pipelines.order)),
    db
      .select({
        id: stages.id,
        name: stages.name,
        order: stages.order,
        pipelineId: stages.pipelineId,
      })
      .from(stages)
      .orderBy(asc(stages.order)),
    db.select().from(tags).orderBy(tags.name),
    db
      .select({ tagId: dealTags.tagId })
      .from(dealTags)
      .where(eq(dealTags.dealId, id)),
    db
      .select({ id: contacts.id, name: contacts.name, phone: contacts.phone })
      .from(contacts)
      .orderBy(asc(contacts.name)),
    db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name)),
    db
      .select()
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.entity, "deal"))
      .orderBy(asc(customFieldDefinitions.order)),
    getAllowedChannelIds(session.user.id, session.user.role),
  ]);

  if (!contact) notFound();

  const [
    thread,
    contactFieldDefRows,
    contactTagRows,
    taskRows,
    manualStageTaskRows,
    allowedChannels,
    pendingScheduled,
    googleConnectionOwner,
  ] = await Promise.all([
      getThread(contact.id, allowedChannelIds),
      db
        .select()
        .from(customFieldDefinitions)
        .where(eq(customFieldDefinitions.entity, "contact"))
        .orderBy(asc(customFieldDefinitions.order)),
      db
        .select({ tagId: contactTags.tagId })
        .from(contactTags)
        .where(eq(contactTags.contactId, contact.id)),
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          type: tasks.type,
          status: tasks.status,
          dueAt: tasks.dueAt,
          templateContent: messageTemplates.content,
        })
        .from(tasks)
        .leftJoin(stageTasks, eq(tasks.stageTaskId, stageTasks.id))
        .leftJoin(messageTemplates, eq(stageTasks.messageTemplateId, messageTemplates.id))
        .where(eq(tasks.dealId, id)),
      db
        .select({ id: stageTasks.id, title: stageTasks.title, type: stageTasks.type })
        .from(stageTasks)
        .where(
          and(eq(stageTasks.stageId, deal.stageId), eq(stageTasks.isAutomatic, false))
        )
        .orderBy(asc(stageTasks.order)),
      allowedChannelIds.length > 0
        ? db
            .select({
              id: whatsappChannels.id,
              label: whatsappChannels.label,
              isDefault: whatsappChannels.isDefault,
            })
            .from(whatsappChannels)
            .where(inArray(whatsappChannels.id, allowedChannelIds))
        : Promise.resolve([]),
      getPendingScheduledMessages(contact.id),
      resolveConnectionOwner(session.user.id),
    ]);

  const isGoogleConnected = googleConnectionOwner != null;

  const manualStageTasks: ManualStageTask[] = manualStageTaskRows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
  }));

  const allTags: TagOption[] = allTagRows.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
  }));
  const tagById = new Map(allTags.map((tag) => [tag.id, tag]));
  const dealTagIds = dealTagRows.map((row) => row.tagId);
  const dealTagsList = dealTagIds
    .map((tagId) => tagById.get(tagId))
    .filter((tag): tag is TagOption => Boolean(tag));

  const contactTagIds = contactTagRows.map((row) => row.tagId);
  const contactTagsList = contactTagIds
    .map((tagId) => tagById.get(tagId))
    .filter((tag): tag is TagOption => Boolean(tag));

  const fieldDefinitions = fieldDefRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));

  const customFields = (deal.customFields as Record<string, unknown>) ?? {};
  const value = formatCurrencyBRL(deal.value);

  const contactFieldDefinitions: FieldDef[] = contactFieldDefRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));
  const contactCustomFields = (contact.customFields as Record<string, unknown>) ?? {};

  const variableValues: Record<string, string> = {
    nome_contato: contact.name,
    valor: value ?? "",
  };
  for (const def of fieldDefinitions) {
    if (customFields[def.key] != null) {
      variableValues[def.key] = formatCustomFieldValue(def, customFields[def.key]);
    }
  }
  for (const def of contactFieldDefinitions) {
    if (contactCustomFields[def.key] != null) {
      variableValues[def.key] = formatCustomFieldValue(def, contactCustomFields[def.key]);
    }
  }

  const dealTasks: DealTask[] = taskRows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    messagePreview: row.templateContent
      ? substituteTemplate(row.templateContent, variableValues)
      : null,
  }));

  const lastChannelId = [...thread].reverse().find((m) => m.channelId)?.channelId;
  const defaultChannel = allowedChannels.find((c) => c.isDefault);
  const preselectedChannelId =
    (lastChannelId && allowedChannels.some((c) => c.id === lastChannelId)
      ? lastChannelId
      : null) ??
    defaultChannel?.id ??
    allowedChannels[0]?.id ??
    null;

  const formProps = {
    pipelines: allPipelines.map((p) => ({ id: p.id, name: p.name })),
    stages: allStages,
    contacts: contactRows,
    owners: ownerRows,
    fieldDefinitions,
    allTags,
    currentUserId: session.user.id,
  };

  return (
    <div className="space-y-6">
      <Link
        href="/negocios"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} strokeWidth={1.75} />
        Negócios
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{deal.title}</h1>
            {deal.status !== "aberto" && (
              <Badge variant={deal.status === "ganho" ? "success" : "danger"}>
                {deal.status === "ganho" ? "Ganho" : "Perdido"}
              </Badge>
            )}
            {deal.temperature && (
              <Badge variant={TEMPERATURE_BADGE_VARIANT[deal.temperature]} dot>
                {TEMPERATURE_LABELS[deal.temperature]}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {pipeline?.name} → {stage?.name}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <DealStatusActions dealId={deal.id} status={deal.status} />
          <DealFormDialog
            {...formProps}
            mode="edit"
            deal={{
              id: deal.id,
              title: deal.title,
              contactId: deal.contactId,
              pipelineId: deal.pipelineId,
              stageId: deal.stageId,
              ownerId: deal.ownerId,
              value: deal.value,
              customFields,
              tagIds: dealTagIds,
            }}
            trigger={<Button type="button" variant="outline" />}
            triggerLabel="Editar"
          />
          <DeleteDealDialog deal={deal} redirectTo="/negocios" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados do negócio</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-0.5">
                <dt className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Valor
                </dt>
                <dd className="text-sm">{value ?? "—"}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Dono
                </dt>
                <dd className="text-sm">{owner?.name ?? "—"}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Pipeline / Etapa
                </dt>
                <dd className="text-sm">
                  {pipeline?.name} → {stage?.name}
                </dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Status
                </dt>
                <dd className="text-sm capitalize">{deal.status}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Temperatura
                </dt>
                <dd className="text-sm">
                  {deal.temperature ? TEMPERATURE_LABELS[deal.temperature] : "—"}
                </dd>
              </div>
              <div className="space-y-0.5 sm:col-span-2">
                <dt className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Tags
                </dt>
                <dd className="pt-0.5">
                  {dealTagsList.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {dealTagsList.map((tag) => (
                        <Badge key={tag.id} variant="secondary" dot>
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm">—</span>
                  )}
                </dd>
              </div>
              {fieldDefinitions.map((field) => (
                <div key={field.id} className="space-y-0.5">
                  <dt className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    {field.label}
                  </dt>
                  <dd className="text-sm">
                    {formatCustomFieldValue(field, customFields[field.key])}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Dados do contato</CardTitle>
            <ContactFormDialog
              mode="edit"
              contact={{
                id: contact.id,
                name: contact.name,
                phone: contact.phone,
                email: contact.email,
                customFields: contactCustomFields,
                tagIds: contactTagIds,
              }}
              fieldDefinitions={contactFieldDefinitions}
              allTags={allTags}
              trigger={<Button type="button" variant="outline" size="sm" />}
              triggerLabel="Editar contato"
            />
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-0.5">
                <dt className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Nome
                </dt>
                <dd className="text-sm">
                  <Link
                    href={`/contatos/${contact.id}`}
                    className="text-primary hover:underline"
                  >
                    {contact.name}
                  </Link>
                </dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Telefone
                </dt>
                <dd className="text-sm">{contact.phone}</dd>
              </div>
              <div className="space-y-0.5">
                <dt className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Email
                </dt>
                <dd className="text-sm">{contact.email ?? "—"}</dd>
              </div>
              <div className="space-y-0.5 sm:col-span-2">
                <dt className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Tags
                </dt>
                <dd className="pt-0.5">
                  {contactTagsList.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {contactTagsList.map((tag) => (
                        <Badge key={tag.id} variant="secondary" dot>
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm">—</span>
                  )}
                </dd>
              </div>
              {contactFieldDefinitions.map((field) => (
                <div key={field.id} className="space-y-0.5">
                  <dt className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    {field.label}
                  </dt>
                  <dd className="text-sm">
                    {formatCustomFieldValue(field, contactCustomFields[field.key])}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Tarefas</CardTitle>
          <div className="flex items-center gap-2">
            <ScheduleMeetingDialog
              dealId={deal.id}
              contactEmail={contact.email}
              isConnected={isGoogleConnected}
              trigger={<Button type="button" variant="outline" size="sm" />}
              triggerLabel="Agendar reunião"
            />
            <ScheduleMessageDialog
              contactId={contact.id}
              dealId={deal.id}
              channels={allowedChannels.map((c) => ({ id: c.id, label: c.label }))}
              defaultChannelId={preselectedChannelId}
              trigger={<Button type="button" variant="outline" size="sm" />}
              triggerLabel="Agendar mensagem"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingScheduled.length > 0 && (
            <ScheduledMessagesList
              messages={pendingScheduled.map((m) => ({
                id: m.id,
                content: m.content,
                scheduledAt: m.scheduledAt.toISOString(),
              }))}
            />
          )}
          <DealTasksPanel
            dealId={deal.id}
            contactId={contact.id}
            contactEmail={contact.email}
            isGoogleConnected={isGoogleConnected}
            tasks={dealTasks}
            manualStageTasks={manualStageTasks}
            channels={allowedChannels.map((c) => ({ id: c.id, label: c.label }))}
            preselectedChannelId={preselectedChannelId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Histórico de conversa</CardTitle>
          <a
            href={`/api/conversations/${contact.id}/export`}
            className="text-sm text-primary hover:underline"
          >
            Exportar conversa (.md)
          </a>
        </CardHeader>
        <CardContent>
          <MessageList
            messages={thread}
            emptyMessage="Nenhuma conversa registrada com este contato ainda."
          />
        </CardContent>
      </Card>
    </div>
  );
}
