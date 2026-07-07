import { redirect } from "next/navigation";
import { and, asc, count, eq, inArray } from "drizzle-orm";
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
  tasks,
  users,
} from "@/db/schema";
import { getLastMessagePreviewsByDealId } from "@/lib/deals";
import type { TagOption } from "@/lib/tags";
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

  const [allPipelines, allTagRows, contactRows, ownerRows, fieldDefRows] =
    await Promise.all([
      db.select().from(pipelines).orderBy(asc(pipelines.order)),
      db.select().from(tags).orderBy(tags.name),
      db
        .select({ id: contacts.id, name: contacts.name, phone: contacts.phone })
        .from(contacts)
        .orderBy(asc(contacts.name)),
      db
        .select({ id: users.id, name: users.name })
        .from(users)
        .orderBy(asc(users.name)),
      db
        .select()
        .from(customFieldDefinitions)
        .where(eq(customFieldDefinitions.entity, "deal"))
        .orderBy(asc(customFieldDefinitions.order)),
    ]);

  const selectedPipelineId =
    (requestedPipelineId &&
      allPipelines.some((p) => p.id === requestedPipelineId) &&
      requestedPipelineId) ||
    allPipelines[0]?.id ||
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
          contactId: deals.contactId,
          ownerId: deals.ownerId,
          customFields: deals.customFields,
          stageId: deals.stageId,
          pipelineId: deals.pipelineId,
        })
        .from(deals)
        .where(eq(deals.pipelineId, selectedPipelineId))
    : [];

  const dealIds = pipelineDeals.map((d) => d.id);
  const contactById = new Map(contactRows.map((c) => [c.id, c]));
  const ownerById = new Map(ownerRows.map((o) => [o.id, o]));

  const [dealTagRows, messagePreviewByDealId, pendingTaskRows] = await Promise.all([
    dealIds.length > 0
      ? db
          .select({ dealId: dealTags.dealId, tagId: dealTags.tagId })
          .from(dealTags)
          .where(inArray(dealTags.dealId, dealIds))
      : Promise.resolve([]),
    getLastMessagePreviewsByDealId(dealIds),
    dealIds.length > 0
      ? db
          .select({ dealId: tasks.dealId, pendingCount: count(tasks.id) })
          .from(tasks)
          .where(and(inArray(tasks.dealId, dealIds), eq(tasks.status, "pendente")))
          .groupBy(tasks.dealId)
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
      contactId: deal.contactId,
      contactName: contact?.name ?? "Contato",
      contactPhone: contact?.phone ?? "",
      ownerId: deal.ownerId,
      ownerName: owner?.name ?? null,
      tags: tagIds
        .map((id) => tagById.get(id))
        .filter((tag): tag is TagOption => Boolean(tag)),
      customFields: (deal.customFields as Record<string, unknown>) ?? {},
      stageId: deal.stageId,
      pipelineId: deal.pipelineId,
      messagePreview: messagePreviewByDealId.get(deal.id) ?? null,
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
        pipelines={allPipelines.map((p) => ({ id: p.id, name: p.name }))}
        selectedPipelineId={selectedPipelineId}
        stages={allStages}
        deals={dealCards}
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
