import { redirect } from "next/navigation";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  contacts,
  customFieldDefinitions,
  dealTags,
  deals,
  lossReasons,
  pipelines,
  stages,
  tags,
  tasks,
  users,
} from "@/db/schema";
import { getUnreadCountsByContactId } from "@/lib/conversations";
import { getLastMessagePreviewsByContactId } from "@/lib/deals";
import { getPipelinesForUser } from "@/lib/pipeline-visibility";
import type { TagOption } from "@/lib/tags";
import { ownerVisibilityFilter } from "@/lib/visibility";
import { KanbanBoard } from "./kanban-board";
import type { DealCardData } from "./deal-card";

export const dynamic = "force-dynamic";

export default async function NegociosPage({
  searchParams,
}: {
  searchParams: Promise<{ pipelineId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { pipelineId: requestedPipelineId } = await searchParams;

  const [
    allPipelines,
    visiblePipelines,
    currentUserRow,
    allTagRows,
    contactRows,
    ownerRows,
    fieldDefRows,
  ] = await Promise.all([
    db.select().from(pipelines).orderBy(asc(pipelines.order)),
    getPipelinesForUser(session.user),
    db
      .select({ defaultPipelineId: users.defaultPipelineId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then((r) => r[0]),
    db.select().from(tags).orderBy(tags.name),
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        phone: contacts.phone,
        avatarUrl: contacts.avatarUrl,
      })
      .from(contacts)
      .orderBy(asc(contacts.name)),
    db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .orderBy(asc(users.name)),
    db
      .select()
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.entity, "deal"))
      .orderBy(asc(customFieldDefinitions.order)),
  ]);

  const defaultPipelineId = currentUserRow?.defaultPipelineId ?? null;

  // Pipeline pré-selecionada: a pedida na URL (se visível pra este usuário)
  // → a padrão configurada pra ele (se visível) → a primeira visível — ver
  // getPipelinesForUser em src/lib/pipeline-visibility.ts.
  const selectedPipelineId =
    (requestedPipelineId &&
      visiblePipelines.some((p) => p.id === requestedPipelineId) &&
      requestedPipelineId) ||
    (defaultPipelineId &&
      visiblePipelines.some((p) => p.id === defaultPipelineId) &&
      defaultPipelineId) ||
    visiblePipelines[0]?.id ||
    "";

  // Busca as etapas de TODAS as pipelines (não só a selecionada): o modal
  // de negócio permite trocar de pipeline sem sair do formulário, então
  // precisa das etapas de qualquer pipeline disponível pra popular o
  // select de etapa dinamicamente.
  const allStages = await db
    .select({
      id: stages.id,
      name: stages.name,
      order: stages.order,
      pipelineId: stages.pipelineId,
    })
    .from(stages)
    .orderBy(asc(stages.order));

  const pipelineDeals = selectedPipelineId
    ? await db
        .select({
          id: deals.id,
          title: deals.title,
          value: deals.value,
          status: deals.status,
          temperature: deals.temperature,
          updatedAt: deals.updatedAt,
          createdAt: deals.createdAt,
          stageEnteredAt: deals.stageEnteredAt,
          contactId: deals.contactId,
          ownerId: deals.ownerId,
          customFields: deals.customFields,
          stageId: deals.stageId,
          pipelineId: deals.pipelineId,
        })
        .from(deals)
        .where(
          and(
            eq(deals.pipelineId, selectedPipelineId),
            ownerVisibilityFilter(deals.ownerId, session.user)
          )
        )
    : [];

  const dealIds = pipelineDeals.map((d) => d.id);
  const contactIds = [...new Set(pipelineDeals.map((d) => d.contactId))];
  const contactById = new Map(contactRows.map((c) => [c.id, c]));
  const ownerById = new Map(ownerRows.map((o) => [o.id, o]));

  const [
    dealTagRows,
    messagePreviewByContactId,
    unreadCountByContactId,
    pendingTaskRows,
    pipelineLossReasons,
  ] = await Promise.all([
    dealIds.length > 0
      ? db
          .select({ dealId: dealTags.dealId, tagId: dealTags.tagId })
          .from(dealTags)
          .where(inArray(dealTags.dealId, dealIds))
      : Promise.resolve([]),
    getLastMessagePreviewsByContactId(contactIds),
    getUnreadCountsByContactId(contactIds),
    dealIds.length > 0
      ? db
          .select({ dealId: tasks.dealId, pendingCount: count(tasks.id) })
          .from(tasks)
          .where(and(inArray(tasks.dealId, dealIds), eq(tasks.status, "pendente")))
          .groupBy(tasks.dealId)
      : Promise.resolve([]),
    selectedPipelineId
      ? db
          .select({ id: lossReasons.id, label: lossReasons.label })
          .from(lossReasons)
          .where(eq(lossReasons.pipelineId, selectedPipelineId))
          .orderBy(asc(lossReasons.order))
      : Promise.resolve([]),
  ]);

  const pendingTaskCountByDeal = new Map(
    pendingTaskRows.map((row) => [row.dealId, row.pendingCount])
  );

  const allTags: TagOption[] = allTagRows.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
  }));
  const tagById = new Map(allTags.map((tag) => [tag.id, tag]));

  const tagIdsByDeal = new Map<string, string[]>();
  for (const row of dealTagRows) {
    const list = tagIdsByDeal.get(row.dealId) ?? [];
    list.push(row.tagId);
    tagIdsByDeal.set(row.dealId, list);
  }

  const dealCards: DealCardData[] = pipelineDeals.map((deal) => {
    const contact = contactById.get(deal.contactId);
    const owner = deal.ownerId ? ownerById.get(deal.ownerId) : undefined;
    const tagIds = tagIdsByDeal.get(deal.id) ?? [];
    return {
      id: deal.id,
      title: deal.title,
      value: deal.value,
      status: deal.status,
      temperature: deal.temperature,
      updatedAt: deal.updatedAt,
      createdAt: deal.createdAt,
      stageEnteredAt: deal.stageEnteredAt,
      contactId: deal.contactId,
      contactName: contact?.name ?? "Contato",
      contactPhone: contact?.phone ?? "",
      contactAvatarUrl: contact?.avatarUrl ?? null,
      ownerId: deal.ownerId,
      ownerName: owner?.name ?? null,
      ownerAvatarUrl: owner?.avatarUrl ?? null,
      tags: tagIds
        .map((id) => tagById.get(id))
        .filter((tag): tag is TagOption => Boolean(tag)),
      customFields: (deal.customFields as Record<string, unknown>) ?? {},
      stageId: deal.stageId,
      pipelineId: deal.pipelineId,
      messagePreview: messagePreviewByContactId.get(deal.contactId) ?? null,
      unreadCount: unreadCountByContactId.get(deal.contactId) ?? 0,
      pendingTaskCount: pendingTaskCountByDeal.get(deal.id) ?? 0,
    };
  });

  const fieldDefinitions = fieldDefRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Negócios</h1>
      <KanbanBoard
        key={selectedPipelineId}
        pipelines={visiblePipelines}
        selectedPipelineId={selectedPipelineId}
        stages={allStages}
        deals={dealCards}
        lossReasons={pipelineLossReasons}
        formProps={{
          pipelines: allPipelines.map((p) => ({ id: p.id, name: p.name })),
          stages: allStages,
          contacts: contactRows,
          owners: ownerRows,
          fieldDefinitions,
          allTags,
          currentUserId: session.user.id,
        }}
      />
    </div>
  );
}
