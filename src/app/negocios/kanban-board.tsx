"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkLostDialog } from "@/components/mark-lost-dialog";
import { formatCurrencyBRL } from "@/lib/deal-format";
import { cn } from "@/lib/utils";
import {
  bulkAddTagAction,
  bulkDeleteDealsAction,
  bulkMoveDealsAction,
  bulkSetLostAction,
  bulkSetOwnerAction,
  bulkSetStatusAction,
  moveDealStageAction,
  setDealLostAction,
  setDealStatusAction,
} from "./actions";
import { BulkActionsBar } from "./bulk-actions-bar";
import { DealCard, type DealCardData } from "./deal-card";
import { DealFormDialog, type DealFormProps } from "./deal-form-dialog";
import {
  DealFiltersBar,
  DEFAULT_FILTERS,
  matchesDealFilters,
  type DealFiltersState,
} from "./deal-filters";

export type KanbanStage = {
  id: string;
  name: string;
  order: number;
  pipelineId: string;
};

type SortOption = "tempo_etapa" | "data_criacao" | "nome" | "valor";

// Padrão pedido pelo usuário: tempo na etapa, dos mais recentes (acabou de
// entrar) pro mais antigo (parado há mais tempo) — ver compareDeals.
const DEFAULT_SORT: SortOption = "tempo_etapa";

const SORT_LABELS: Record<SortOption, string> = {
  tempo_etapa: "Tempo na etapa",
  data_criacao: "Data de criação",
  nome: "Nome",
  valor: "Valor",
};

function compareDeals(a: DealCardData, b: DealCardData, sort: SortOption): number {
  switch (sort) {
    case "tempo_etapa":
      // Mais recente (acabou de entrar) primeiro, mais antigo (mais tempo
      // parado na etapa) por último.
      return b.stageEnteredAt.getTime() - a.stageEnteredAt.getTime();
    case "data_criacao":
      return b.createdAt.getTime() - a.createdAt.getTime();
    case "nome":
      return a.title.localeCompare(b.title, "pt-BR");
    case "valor":
      return (Number(b.value) || 0) - (Number(a.value) || 0);
  }
}

export function KanbanBoard({
  pipelines,
  selectedPipelineId,
  stages,
  deals: initialDeals,
  formProps,
  lossReasons,
}: {
  pipelines: { id: string; name: string }[];
  selectedPipelineId: string;
  stages: KanbanStage[];
  deals: DealCardData[];
  formProps: DealFormProps;
  lossReasons: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deals, setDeals] = useState(initialDeals);
  const [filters, setFilters] = useState<DealFiltersState>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [grabbedDealId, setGrabbedDealId] = useState<string | null>(null);
  const [grabbedPreviewStageId, setGrabbedPreviewStageId] = useState<
    string | null
  >(null);
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [bulkLostDialogOpen, setBulkLostDialogOpen] = useState(false);

  const stagesForPipeline = useMemo(
    () =>
      stages
        .filter((s) => s.pipelineId === selectedPipelineId)
        .sort((a, b) => a.order - b.order),
    [stages, selectedPipelineId]
  );

  const filteredDeals = useMemo(
    () =>
      deals.filter((deal) =>
        matchesDealFilters(
          {
            title: deal.title,
            contactName: deal.contactName,
            ownerId: deal.ownerId,
            tagIds: deal.tags.map((t) => t.id),
            temperature: deal.temperature,
            status: deal.status,
            createdAt: deal.createdAt,
          },
          filters,
          formProps.currentUserId
        )
      ),
    [deals, filters, formProps.currentUserId]
  );

  function commitMove(dealId: string, stageId: string) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stageId === stageId) return;
    const previousStageId = deal.stageId;

    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, stageId, updatedAt: new Date() } : d
      )
    );
    startTransition(() => {
      void moveDealStageAction(dealId, stageId).then(() => router.refresh());
    });

    const stageName = stages.find((s) => s.id === stageId)?.name ?? "";
    toast.success(`Negócio movido para "${stageName}"`, {
      duration: 5000,
      action: {
        label: "Desfazer",
        onClick: () => {
          setDeals((prev) =>
            prev.map((d) =>
              d.id === dealId ? { ...d, stageId: previousStageId } : d
            )
          );
          startTransition(() => {
            void moveDealStageAction(dealId, previousStageId).then(() =>
              router.refresh()
            );
          });
        },
      },
    });
  }

  function handleSetStatus(dealId: string, status: "aberto" | "ganho") {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, status } : d))
    );
    startTransition(() => {
      void setDealStatusAction(dealId, status);
    });
    toast.success(
      status === "aberto" ? "Negócio reaberto" : "Negócio marcado como Ganho"
    );
  }

  function handleSetLost(dealId: string, lossReasonId: string) {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, status: "perdido" } : d))
    );
    startTransition(() => {
      void setDealLostAction(dealId, lossReasonId);
    });
    toast.success("Negócio marcado como Perdido");
  }

  function toggleSelectDeal(dealId: string) {
    setSelectedDealIds((prev) => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedDealIds(new Set());
  }

  // "Todos" respeita os filtros ativos (DealFiltersBar) — seleciona só o que
  // está de fato visível no board, igual ao padrão de outras telas com
  // seleção em massa (ver AtendimentoShell).
  const allFilteredSelected =
    filteredDeals.length > 0 && filteredDeals.every((d) => selectedDealIds.has(d.id));

  function toggleSelectAll() {
    setSelectedDealIds(allFilteredSelected ? new Set() : new Set(filteredDeals.map((d) => d.id)));
  }

  function toggleSelectStage(stageDealIds: string[]) {
    const allSelected = stageDealIds.length > 0 && stageDealIds.every((id) => selectedDealIds.has(id));
    setSelectedDealIds((prev) => {
      const next = new Set(prev);
      for (const id of stageDealIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function handleBulkMoveStage(stageId: string) {
    const ids = Array.from(selectedDealIds);
    setDeals((prev) =>
      prev.map((d) => (ids.includes(d.id) ? { ...d, stageId, updatedAt: new Date() } : d))
    );
    clearSelection();
    await bulkMoveDealsAction(ids, stageId);
    router.refresh();
    toast.success(`${ids.length} negócio(s) movido(s)`);
  }

  async function handleBulkSetOwner(ownerId: string | null) {
    const ids = Array.from(selectedDealIds);
    const owner = formProps.owners.find((o) => o.id === ownerId);
    setDeals((prev) =>
      prev.map((d) =>
        ids.includes(d.id) ? { ...d, ownerId, ownerName: owner?.name ?? null } : d
      )
    );
    clearSelection();
    await bulkSetOwnerAction(ids, ownerId);
    router.refresh();
    toast.success(`Dono atualizado em ${ids.length} negócio(s)`);
  }

  async function handleBulkAddTag(tagId: string) {
    const ids = Array.from(selectedDealIds);
    const tag = formProps.allTags.find((t) => t.id === tagId);
    if (tag) {
      setDeals((prev) =>
        prev.map((d) =>
          ids.includes(d.id) && !d.tags.some((t) => t.id === tagId)
            ? { ...d, tags: [...d.tags, tag] }
            : d
        )
      );
    }
    clearSelection();
    await bulkAddTagAction(ids, tagId);
    router.refresh();
    toast.success(`Tag adicionada a ${ids.length} negócio(s)`);
  }

  async function handleBulkSetStatus(status: "aberto" | "ganho") {
    const ids = Array.from(selectedDealIds);
    setDeals((prev) => prev.map((d) => (ids.includes(d.id) ? { ...d, status } : d)));
    clearSelection();
    await bulkSetStatusAction(ids, status);
    router.refresh();
    toast.success(`Status atualizado em ${ids.length} negócio(s)`);
  }

  async function handleBulkSetLost(lossReasonId: string) {
    const ids = Array.from(selectedDealIds);
    setDeals((prev) =>
      prev.map((d) => (ids.includes(d.id) ? { ...d, status: "perdido" } : d))
    );
    clearSelection();
    await bulkSetLostAction(ids, lossReasonId);
    router.refresh();
    toast.success(`${ids.length} negócio(s) marcado(s) como Perdido`);
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedDealIds);
    setDeals((prev) => prev.filter((d) => !ids.includes(d.id)));
    clearSelection();
    await bulkDeleteDealsAction(ids);
    router.refresh();
    toast.success(`${ids.length} negócio(s) excluído(s)`);
  }

  function handleCardKeyDown(e: React.KeyboardEvent, deal: DealCardData) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (grabbedDealId === deal.id) {
        const target = grabbedPreviewStageId ?? deal.stageId;
        setGrabbedDealId(null);
        setGrabbedPreviewStageId(null);
        commitMove(deal.id, target);
      } else {
        setGrabbedDealId(deal.id);
        setGrabbedPreviewStageId(deal.stageId);
      }
      return;
    }
    if (e.key === "Escape" && grabbedDealId === deal.id) {
      e.preventDefault();
      setGrabbedDealId(null);
      setGrabbedPreviewStageId(null);
      return;
    }
    if (
      grabbedDealId === deal.id &&
      (e.key === "ArrowLeft" || e.key === "ArrowRight")
    ) {
      e.preventDefault();
      const currentStageId = grabbedPreviewStageId ?? deal.stageId;
      const currentIndex = stagesForPipeline.findIndex(
        (s) => s.id === currentStageId
      );
      const delta = e.key === "ArrowLeft" ? -1 : 1;
      const newIndex = currentIndex + delta;
      if (newIndex < 0 || newIndex >= stagesForPipeline.length) return;
      setGrabbedPreviewStageId(stagesForPipeline[newIndex].id);
    }
  }

  if (pipelines.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title="Nenhuma pipeline cadastrada"
        description="Crie uma pipeline em Admin → Pipelines antes de criar negócios."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={Object.fromEntries(pipelines.map((p) => [p.id, p.name]))}
            value={selectedPipelineId}
            onValueChange={(value) => {
              if (value) router.push(`/negocios?pipelineId=${value}`);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={SORT_LABELS}
            value={sortBy}
            onValueChange={(value) => setSortBy((value as SortOption) ?? DEFAULT_SORT)}
          >
            <SelectTrigger className="w-48 text-sm">
              <span className="text-muted-foreground">Ordenar por:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        <DealFormDialog
          {...formProps}
          mode="create"
          defaultPipelineId={selectedPipelineId}
          defaultStageId={stagesForPipeline[0]?.id}
          trigger={<Button type="button" />}
          triggerLabel={
            <>
              <Plus size={16} strokeWidth={1.75} />
              Negócio +
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DealFiltersBar
          filters={filters}
          onChange={setFilters}
          owners={formProps.owners}
          allTags={formProps.allTags}
          currentUserId={formProps.currentUserId}
        />
        {filteredDeals.length > 0 && (
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                allFilteredSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input"
              )}
            >
              {allFilteredSelected && <Check size={11} strokeWidth={2.5} />}
            </span>
            {allFilteredSelected ? "Limpar seleção" : "Selecionar todos"}
          </button>
        )}
      </div>

      {selectedDealIds.size > 0 && (
        <BulkActionsBar
          count={selectedDealIds.size}
          stages={stagesForPipeline}
          owners={formProps.owners}
          allTags={formProps.allTags}
          onMoveStage={handleBulkMoveStage}
          onSetOwner={handleBulkSetOwner}
          onAddTag={handleBulkAddTag}
          onSetStatus={handleBulkSetStatus}
          onRequestMarkLost={() => setBulkLostDialogOpen(true)}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
        />
      )}
      <MarkLostDialog
        open={bulkLostDialogOpen}
        onOpenChange={setBulkLostDialogOpen}
        reasons={lossReasons}
        onConfirm={handleBulkSetLost}
      />

      {stagesForPipeline.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Pipeline sem etapas"
          description="Cadastre etapas para esta pipeline em Admin → Pipelines."
        />
      ) : deals.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Nenhum negócio nesta pipeline"
          description='Crie o primeiro negócio pelo botão "Negócio +".'
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {stagesForPipeline.map((stage) => {
            const stageDeals = filteredDeals
              .filter((d) => d.stageId === stage.id)
              .sort((a, b) => compareDeals(a, b, sortBy));
            const sum = stageDeals.reduce(
              (acc, d) => acc + (d.value ? Number(d.value) : 0),
              0
            );
            const otherStages = stagesForPipeline
              .filter((s) => s.id !== stage.id)
              .map((s) => ({ id: s.id, name: s.name }));

            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStageId(stage.id);
                }}
                onDrop={() => {
                  if (draggedDealId) commitMove(draggedDealId, stage.id);
                  setDraggedDealId(null);
                  setDragOverStageId(null);
                }}
                className={
                  "flex w-72 shrink-0 flex-col gap-3 rounded-xl border border-transparent p-1 " +
                  (dragOverStageId === stage.id && draggedDealId
                    ? "border-dashed border-primary bg-primary/5"
                    : "")
                }
              >
                <div className="flex items-baseline justify-between rounded-lg bg-secondary px-3 py-2">
                  <div className="flex min-w-0 items-baseline gap-1.5">
                    {stageDeals.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleSelectStage(stageDeals.map((d) => d.id))}
                        aria-label={
                          stageDeals.every((d) => selectedDealIds.has(d.id))
                            ? `Remover todos de "${stage.name}" da seleção`
                            : `Selecionar todos de "${stage.name}"`
                        }
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center self-center rounded border transition-colors",
                          stageDeals.every((d) => selectedDealIds.has(d.id))
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input hover:border-primary/60"
                        )}
                      >
                        {stageDeals.every((d) => selectedDealIds.has(d.id)) && (
                          <Check size={11} strokeWidth={2.5} />
                        )}
                      </button>
                    )}
                    <span className="truncate text-sm font-semibold">{stage.name}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {stageDeals.length} · {formatCurrencyBRL(sum.toFixed(2))}
                  </span>
                </div>

                {stageDeals.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    Nenhum negócio nesta etapa.
                  </p>
                ) : (
                  // max-h aproxima 5 cards visíveis (altura varia com legenda de
                  // mensagem/tags de cada negócio) + início do 6º espiando — o
                  // resto só aparece rolando esta coluna, pra uma etapa com
                  // muitos negócios não esticar a página inteira (a rolagem
                  // geral da página continua em AppShell, ver <main
                  // overflow-y-auto>).
                  <div className="flex max-h-[820px] flex-col gap-3 overflow-y-auto pr-1">
                    {stageDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        otherStages={otherStages}
                        formProps={formProps}
                        lossReasons={lossReasons}
                        onMoveStage={(stageId) => commitMove(deal.id, stageId)}
                        onSetStatus={(status) => handleSetStatus(deal.id, status)}
                        onSetLost={(lossReasonId) => handleSetLost(deal.id, lossReasonId)}
                        isGrabbed={grabbedDealId === deal.id}
                        grabbedPreviewStageName={
                          grabbedDealId === deal.id
                            ? (stages.find(
                                (s) =>
                                  s.id === (grabbedPreviewStageId ?? deal.stageId)
                              )?.name ?? null)
                            : null
                        }
                        draggable={selectedDealIds.size === 0}
                        onDragStart={() => setDraggedDealId(deal.id)}
                        onDragEnd={() => {
                          setDraggedDealId(null);
                          setDragOverStageId(null);
                        }}
                        onKeyDown={(e) => handleCardKeyDown(e, deal)}
                        selected={selectedDealIds.has(deal.id)}
                        onToggleSelect={() => toggleSelectDeal(deal.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
