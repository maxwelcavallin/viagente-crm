import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, ListTodo } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  contacts,
  customFieldDefinitions,
  dealTags,
  deals,
  pipelines,
  stages,
  tags,
  users,
} from "@/db/schema";
import { getAllowedChannelIds } from "@/lib/channel-access";
import { getThread } from "@/lib/conversations";
import { formatCustomFieldValue } from "@/lib/custom-fields";
import { formatCurrencyBRL } from "@/lib/deal-format";
import { TEMPERATURE_BADGE_VARIANT, TEMPERATURE_LABELS } from "@/lib/temperature";
import type { TagOption } from "@/lib/tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageList } from "@/components/message-list";
import { DealFormDialog } from "../deal-form-dialog";
import { DeleteDealDialog } from "../delete-deal-dialog";
import { DealStatusActions } from "./deal-status-actions";

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

  const thread = await getThread(contact.id, allowedChannelIds);

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

  const fieldDefinitions = fieldDefRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));

  const customFields = (deal.customFields as Record<string, unknown>) ?? {};
  const value = formatCurrencyBRL(deal.value);

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
          <p className="text-sm text-muted-foreground">
            Contato:{" "}
            <Link href={`/contatos/${contact.id}`} className="text-primary hover:underline">
              {contact.name}
            </Link>{" "}
            — {contact.phone}
          </p>
          {owner && (
            <p className="text-sm text-muted-foreground">Dono: {owner.name}</p>
          )}
          {value && <p className="text-sm font-medium">{value}</p>}
          {dealTagsList.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {dealTagsList.map((tag) => (
                <Badge key={tag.id} variant="secondary" dot>
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
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
          <CardTitle>Tarefas</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={ListTodo}
            title="Nenhuma tarefa ainda"
            description="A automação de tarefas por etapa chega na próxima etapa do produto."
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
