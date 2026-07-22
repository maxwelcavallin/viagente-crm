import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, ArrowRight, Briefcase } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  contactTags,
  contacts,
  customFieldDefinitions,
  deals,
  meetingNotes,
  meetingNotesContacts,
  pipelines,
  stages,
  tags,
  users,
} from "@/db/schema";
import { getAllowedChannelIds } from "@/lib/channel-access";
import { findDuplicateContact } from "@/lib/contact-merge";
import { getRecentThreadMessages } from "@/lib/conversations";
import { formatCurrencyBRL } from "@/lib/deal-format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DuplicateContactBanner } from "@/components/duplicate-contact-banner";
import { ConversationPreviewCard } from "@/components/conversation-preview-card";
import { MeetingNotesList, type MeetingNoteItem } from "@/components/meeting-notes-list";
import { ContactFormDialog, type FieldDef, type TagOption } from "../contact-form-dialog";
import { DeleteContactDialog } from "../delete-contact-dialog";
import { formatCustomFieldValue } from "../custom-field-format";
import { Button } from "@/components/ui/button";
import { DealFormDialog } from "@/app/negocios/deal-form-dialog";

export const dynamic = "force-dynamic";

export default async function ContatoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);
  if (!contact) notFound();

  const [
    fieldDefRows,
    allTagRows,
    contactTagRows,
    allowedChannelIds,
    dealFieldDefRows,
    allPipelines,
    allStages,
    ownerRows,
    meetingNoteRows,
    contactDealRows,
  ] = await Promise.all([
    db
      .select()
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.entity, "contact"))
      .orderBy(asc(customFieldDefinitions.order)),
    db.select().from(tags).orderBy(tags.name),
    db
      .select({ tagId: contactTags.tagId })
      .from(contactTags)
      .where(eq(contactTags.contactId, id)),
    getAllowedChannelIds(session.user.id, session.user.role),
    db
      .select()
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.entity, "deal"))
      .orderBy(asc(customFieldDefinitions.order)),
    db.select({ id: pipelines.id, name: pipelines.name }).from(pipelines).orderBy(asc(pipelines.order)),
    db
      .select({ id: stages.id, name: stages.name, order: stages.order, pipelineId: stages.pipelineId })
      .from(stages)
      .orderBy(asc(stages.order)),
    db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name)),
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
      .where(eq(meetingNotesContacts.contactId, id))
      .orderBy(desc(meetingNotes.meetingDate)),
    db
      .select({
        id: deals.id,
        title: deals.title,
        value: deals.value,
        status: deals.status,
        stageId: deals.stageId,
        pipelineId: deals.pipelineId,
        createdAt: deals.createdAt,
      })
      .from(deals)
      .where(eq(deals.contactId, id))
      .orderBy(desc(deals.createdAt)),
  ]);

  // undefined = sem filtro de canal — esta página mostra o histórico como
  // referência mesclada, diferente do Atendimento (que separa por canal). Só
  // as últimas mensagens (ver ConversationPreviewCard), não a conversa
  // inteira.
  const recentMessages = await getRecentThreadMessages(id, undefined, allowedChannelIds);
  const duplicate = await findDuplicateContact(contact.phone, contact.email, id);

  const fieldDefinitions: FieldDef[] = fieldDefRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));

  const allTags: TagOption[] = allTagRows.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
  }));
  const tagById = new Map(allTags.map((tag) => [tag.id, tag]));
  const contactTagIds = contactTagRows.map((row) => row.tagId);
  const contactTagsList = contactTagIds
    .map((tagId) => tagById.get(tagId))
    .filter((tag): tag is TagOption => Boolean(tag));

  const customFields = (contact.customFields as Record<string, unknown>) ?? {};

  const dealFieldDefinitions: FieldDef[] = dealFieldDefRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));

  const stageById = new Map(allStages.map((s) => [s.id, s]));
  const pipelineById = new Map(allPipelines.map((p) => [p.id, p]));
  const STATUS_BADGE = {
    aberto: "info",
    ganho: "success",
    perdido: "danger",
  } as const;
  const STATUS_LABEL = {
    aberto: "Aberto",
    ganho: "Ganho",
    perdido: "Perdido",
  } as const;

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

  return (
    <div className="space-y-6">
      <Link
        href="/contatos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} strokeWidth={1.75} />
        Contatos
      </Link>

      {duplicate && <DuplicateContactBanner contactId={contact.id} duplicate={duplicate} />}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{contact.name}</h1>
          <p className="text-sm text-muted-foreground">{contact.phone}</p>
          {contact.email && (
            <p className="text-sm text-muted-foreground">{contact.email}</p>
          )}
          {contactTagsList.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {contactTagsList.map((tag) => (
                <Badge key={tag.id} variant="secondary" dot>
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DealFormDialog
            mode="create"
            pipelines={allPipelines}
            stages={allStages}
            contacts={[{ id: contact.id, name: contact.name, phone: contact.phone }]}
            owners={ownerRows}
            fieldDefinitions={dealFieldDefinitions}
            allTags={allTags}
            currentUserId={session.user.id}
            lockedContact={{ id: contact.id, name: contact.name, phone: contact.phone }}
            trigger={<Button type="button" variant="outline" />}
            triggerLabel={
              <>
                <Briefcase size={14} strokeWidth={1.75} />
                Criar negócio
              </>
            }
          />
          <ContactFormDialog
            mode="edit"
            contact={{
              id: contact.id,
              name: contact.name,
              phone: contact.phone,
              email: contact.email,
              customFields,
              tagIds: contactTagIds,
            }}
            fieldDefinitions={fieldDefinitions}
            allTags={allTags}
            trigger={<Button type="button" variant="outline" />}
            triggerLabel="Editar"
          />
          <DeleteContactDialog contact={contact} redirectTo="/contatos" />
        </div>
      </div>

      {fieldDefinitions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Campos customizados</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      )}

      <Card>
        <CardHeader>
          <CardTitle>Negócios vinculados</CardTitle>
        </CardHeader>
        <CardContent>
          {contactDealRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum negócio vinculado a este contato ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {contactDealRows.map((deal) => {
                const stage = stageById.get(deal.stageId);
                const pipeline = pipelineById.get(deal.pipelineId);
                const value = formatCurrencyBRL(deal.value);
                return (
                  <li key={deal.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{deal.title}</span>
                        <Badge variant={STATUS_BADGE[deal.status]}>
                          {STATUS_LABEL[deal.status]}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {pipeline?.name ?? "—"}
                        {stage ? ` > ${stage.name}` : ""}
                        {value ? ` · ${value}` : ""}
                      </p>
                    </div>
                    <Link
                      href={`/negocios/${deal.id}`}
                      className="flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Ir para negócio
                      <ArrowRight size={14} strokeWidth={1.75} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo de Reuniões</CardTitle>
        </CardHeader>
        <CardContent>
          <MeetingNotesList notes={meetingNoteItems} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de conversa</CardTitle>
        </CardHeader>
        <CardContent>
          <ConversationPreviewCard
            contactId={contact.id}
            messages={recentMessages}
            historyHref={`/atendimento/${contact.id}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
