import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, count, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  contactTags,
  contacts,
  customFieldDefinitions,
  dealTags,
  deals,
  emailsSent,
  emailTemplates,
  instagramChannels,
  lossReasons,
  meetingNotes,
  meetingNotesContacts,
  messageTemplateItems,
  pipelines,
  stages,
  stageTasks,
  tags,
  tasks,
  users,
  whatsappChannels,
} from "@/db/schema";
import { getAllowedChannelIds } from "@/lib/channel-access";
import { findDuplicateContact } from "@/lib/contact-merge";
import { getContactChannelPreviews } from "@/lib/conversations";
import { formatCustomFieldValue, type FieldDef } from "@/lib/custom-fields";
import { getDealActivityLogPage } from "@/lib/deal-activity-log";
import { formatCurrencyBRL } from "@/lib/deal-format";
import { resolveConnectionOwner } from "@/lib/google-calendar";
import { getPendingScheduledMessages } from "@/lib/scheduled-messages";
import { canViewOwnedRecord } from "@/lib/visibility";
import { firstNameOf, getQuickFillMessageTemplates, substituteTemplate } from "@/lib/templates";
import { TEMPERATURE_BADGE_VARIANT, TEMPERATURE_LABELS } from "@/lib/temperature";
import type { TagOption } from "@/lib/tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DuplicateContactBanner } from "@/components/duplicate-contact-banner";
import { ScheduleMessageDialog } from "@/components/schedule-message-dialog";
import { ScheduledMessagesList } from "@/components/scheduled-messages-list";
import { ScheduleMeetingDialog } from "@/components/schedule-meeting-dialog";
import { ContactFormDialog } from "@/app/contatos/contact-form-dialog";
import { DealFormDialog } from "../deal-form-dialog";
import { DeleteDealDialog } from "../delete-deal-dialog";
import { DealActivityLogCard } from "./deal-activity-log-card";
import { DealStatusActions } from "./deal-status-actions";
import { ConversationPreviewCard } from "@/components/conversation-preview-card";
import { SyncMeetingNotesButton } from "./sync-meeting-notes-button";
import { DealTasksPanel, type DealTask, type StageTaskConfig } from "./deal-tasks-panel";
import { EmailComposeDialog } from "@/components/email-compose-dialog";
import { EmailsSentList } from "./emails-sent-list";
import { MeetingNotesList, type MeetingNoteItem } from "@/components/meeting-notes-list";

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
  if (!canViewOwnedRecord(deal.ownerId, session.user)) notFound();

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
    pipelineLossReasons,
    contactDealCount,
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
    db
      .select({ id: lossReasons.id, label: lossReasons.label })
      .from(lossReasons)
      .where(eq(lossReasons.pipelineId, deal.pipelineId))
      .orderBy(asc(lossReasons.order)),
    // Resumo de quantos negócios esse contato tem no total — item 4:
    // continua fácil perceber que o mesmo contato participa de mais de uma
    // pipeline (cada uma com seu próprio dono, ver owner-distribution.ts).
    db
      .select({ count: count(deals.id) })
      .from(deals)
      .where(eq(deals.contactId, deal.contactId))
      .then((r) => r[0]?.count ?? 0),
  ]);

  if (!contact) notFound();

  // Todas as etapas da pipeline deste negócio, em ordem — base da timeline
  // de tarefas por etapa (ver DealTasksPanel), não só a etapa atual.
  const pipelineStages = allStages
    .filter((s) => s.pipelineId === deal.pipelineId)
    .sort((a, b) => a.order - b.order);
  const pipelineStageIds = pipelineStages.map((s) => s.id);

  const [
    channelPreviews,
    contactFieldDefRows,
    contactTagRows,
    taskRows,
    stageTaskConfigRows,
    allowedWhatsappChannels,
    allowedInstagramChannels,
    pendingScheduled,
    googleConnectionOwner,
    activityLogPage,
    emailTemplateRows,
    emailsSentRows,
    meetingNoteRows,
    templateItemRows,
  ] = await Promise.all([
      // Uma entrada por canal que este contato já usou, cada uma com só as
      // últimas mensagens (ver ConversationPreviewCard) — sem isso a
      // conversa inteira carregava de uma vez, pesado pra contato com
      // histórico longo, e canais diferentes ficavam mesclados numa prévia
      // só.
      getContactChannelPreviews(contact.id, allowedChannelIds),
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
          errorMessage: tasks.errorMessage,
          dueAt: tasks.dueAt,
          stageTaskId: tasks.stageTaskId,
          messageTemplateId: stageTasks.messageTemplateId,
          emailTemplateSubject: emailTemplates.subject,
          emailTemplateContent: emailTemplates.content,
        })
        .from(tasks)
        .leftJoin(stageTasks, eq(tasks.stageTaskId, stageTasks.id))
        .leftJoin(emailTemplates, eq(stageTasks.emailTemplateId, emailTemplates.id))
        .where(eq(tasks.dealId, id)),
      // Todos os modelos de tarefa (automáticos e manuais) de TODAS as
      // etapas da pipeline — não só a etapa atual — pra montar a timeline
      // (ver DealTasksPanel): antes só trazia manual da etapa atual, então
      // uma tarefa configurada numa etapa futura nunca aparecia até o
      // negócio chegar lá.
      pipelineStageIds.length > 0
        ? db
            .select({
              id: stageTasks.id,
              stageId: stageTasks.stageId,
              title: stageTasks.title,
              type: stageTasks.type,
              isAutomatic: stageTasks.isAutomatic,
              order: stageTasks.order,
            })
            .from(stageTasks)
            .where(inArray(stageTasks.stageId, pipelineStageIds))
            .orderBy(asc(stageTasks.order))
        : Promise.resolve([]),
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
      allowedChannelIds.length > 0
        ? db
            .select({
              id: instagramChannels.id,
              label: instagramChannels.label,
              isDefault: instagramChannels.isDefault,
            })
            .from(instagramChannels)
            .where(inArray(instagramChannels.id, allowedChannelIds))
        : Promise.resolve([]),
      getPendingScheduledMessages(contact.id),
      resolveConnectionOwner(session.user.id),
      getDealActivityLogPage(id),
      db
        .select({
          id: emailTemplates.id,
          name: emailTemplates.name,
          subject: emailTemplates.subject,
          content: emailTemplates.content,
        })
        .from(emailTemplates)
        .orderBy(asc(emailTemplates.name)),
      db
        .select()
        .from(emailsSent)
        .where(eq(emailsSent.dealId, id))
        .orderBy(desc(emailsSent.sentAt)),
      db
        .select({
          id: meetingNotes.id,
          title: meetingNotes.title,
          meetingDate: meetingNotes.meetingDate,
          summary: meetingNotes.summary,
          actionItems: meetingNotes.actionItems,
          transcript: meetingNotes.transcript,
          driveFileUrl: meetingNotes.driveFileUrl,
          parsedOk: meetingNotes.parsedOk,
        })
        .from(meetingNotesContacts)
        .innerJoin(meetingNotes, eq(meetingNotesContacts.meetingNoteId, meetingNotes.id))
        .where(eq(meetingNotesContacts.dealId, id))
        .orderBy(desc(meetingNotes.meetingDate)),
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
    ]);

  const allowedChannels = [
    ...allowedWhatsappChannels.map((c) => ({ ...c, channelType: "whatsapp" as const })),
    ...allowedInstagramChannels.map((c) => ({ ...c, channelType: "instagram" as const })),
  ];

  const duplicateContact = await findDuplicateContact(contact.phone, contact.email, contact.id);

  const isGoogleConnected = googleConnectionOwner != null;

  const stageTaskConfigs: StageTaskConfig[] = stageTaskConfigRows.map((row) => ({
    id: row.id,
    stageId: row.stageId,
    title: row.title,
    type: row.type,
    isAutomatic: row.isAutomatic,
    order: row.order,
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
  // Só mostra campo customizado com valor preenchido — página muito grande
  // sobrando "—" pra cada campo vazio, quando a maioria dos negócios só usa
  // uma fração dos campos configurados.
  const filledDealFields = fieldDefinitions.filter((field) => {
    const raw = customFields[field.key];
    return raw != null && raw !== "";
  });

  const contactFieldDefinitions: FieldDef[] = contactFieldDefRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));
  const contactCustomFields = (contact.customFields as Record<string, unknown>) ?? {};
  const filledContactFields = contactFieldDefinitions.filter((field) => {
    const raw = contactCustomFields[field.key];
    return raw != null && raw !== "";
  });

  const variableValues: Record<string, string> = {
    nome_contato: contact.name,
    primeiro_nome: firstNameOf(contact.name),
    email_contato: contact.email ?? "",
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

  const quickFillTemplates = await getQuickFillMessageTemplates(variableValues);

  const meetingNoteItems: MeetingNoteItem[] = meetingNoteRows.map((row) => ({
    id: row.id,
    title: row.title,
    meetingDate: row.meetingDate.toISOString(),
    summary: row.summary,
    actionItems: row.actionItems as string[] | null,
    transcript: row.transcript,
    driveFileUrl: row.driveFileUrl,
    parsedOk: row.parsedOk,
  }));

  const templateItemsByTemplateId = new Map<string, typeof templateItemRows>();
  for (const item of templateItemRows) {
    const list = templateItemsByTemplateId.get(item.templateId) ?? [];
    list.push(item);
    templateItemsByTemplateId.set(item.templateId, list);
  }

  const dealTasks: DealTask[] = taskRows.map((row) => {
    const templateItems = row.messageTemplateId
      ? (templateItemsByTemplateId.get(row.messageTemplateId) ?? [])
      : [];
    return {
      id: row.id,
      title: row.title,
      type: row.type,
      status: row.status,
      errorMessage: row.errorMessage,
      dueAt: row.dueAt ? row.dueAt.toISOString() : null,
      stageTaskId: row.stageTaskId,
      messageItems: templateItems.map((it) => ({
        id: it.id,
        content: substituteTemplate(it.content, variableValues),
        mediaType: it.mediaType,
        mediaFileName: it.mediaFileName,
      })),
      messagePreview: templateItems[0]
        ? substituteTemplate(templateItems[0].content, variableValues)
        : row.emailTemplateContent
          ? substituteTemplate(row.emailTemplateContent, variableValues)
          : null,
      emailSubjectPreview: row.emailTemplateSubject
        ? substituteTemplate(row.emailTemplateSubject, variableValues)
        : null,
    };
  });

  // channelPreviews já vem ordenado por lastMessageAt desc (ver
  // getContactChannelPreviews) — o primeiro com channelId é o canal mais
  // recente.
  const lastChannelId = channelPreviews.find((c) => c.channelId)?.channelId;
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
          <DealStatusActions
            dealId={deal.id}
            status={deal.status}
            lossReasons={pipelineLossReasons}
          />
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
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <div className="space-y-0.5 sm:col-span-2 lg:col-span-3">
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
              {filledDealFields.map((field) => (
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
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/contatos/${contact.id}`} />}
              >
                Ver contato
              </Button>
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
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {duplicateContact && (
              <DuplicateContactBanner contactId={contact.id} duplicate={duplicateContact} />
            )}
            <Link
              href={`/contatos/${contact.id}`}
              className="block text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              {contactDealCount} negócio{contactDealCount === 1 ? "" : "s"} com este contato
            </Link>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <div className="space-y-0.5 sm:col-span-2 lg:col-span-3">
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
              {filledContactFields.map((field) => (
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
              templates={quickFillTemplates}
              trigger={<Button type="button" variant="outline" size="sm" />}
              triggerLabel="Agendar mensagem"
            />
            <EmailComposeDialog
              dealId={deal.id}
              contactId={contact.id}
              contactEmail={contact.email}
              templates={emailTemplateRows}
              trigger={<Button type="button" variant="outline" size="sm" />}
              triggerLabel="Enviar email"
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
            pipelineStages={pipelineStages}
            stageTaskConfigs={stageTaskConfigs}
            currentStageId={deal.stageId}
            channels={allowedChannels.map((c) => ({ id: c.id, label: c.label }))}
            preselectedChannelId={preselectedChannelId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emails enviados</CardTitle>
        </CardHeader>
        <CardContent>
          <EmailsSentList
            emails={emailsSentRows.map((e) => ({
              id: e.id,
              toEmail: e.toEmail,
              subject: e.subject,
              body: e.body,
              status: e.status,
              errorMessage: e.errorMessage,
              sentAt: e.sentAt.toISOString(),
              attachments: (e.attachments as { filename: string; url: string }[]) ?? [],
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Resumo de Reuniões</CardTitle>
          <SyncMeetingNotesButton dealId={deal.id} />
        </CardHeader>
        <CardContent>
          <MeetingNotesList notes={meetingNoteItems} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de alterações</CardTitle>
        </CardHeader>
        <CardContent>
          <DealActivityLogCard
            dealId={deal.id}
            initialItems={activityLogPage.items}
            initialHasMore={activityLogPage.hasMore}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de conversa</CardTitle>
        </CardHeader>
        <CardContent>
          <ConversationPreviewCard contactId={contact.id} channels={channelPreviews} />
        </CardContent>
      </Card>
    </div>
  );
}
