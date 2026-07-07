"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Workflow } from "lucide-react";
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
import { formatCurrencyBRL } from "@/lib/deal-format";
import { moveDealStageAction, setDealStatusAction } from "./actions";
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

export function KanbanBoard({
  pipelines,
  selectedPipelineId,
  stages,
  deals: initialDeals,
  formProps,
}: {
  pipelines: { id: string; name: string }[];
  selectedPipelineId: string;
  stages: KanbanStage[];
  deals: DealCardData[];
  formProps: DealFormProps;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deals, setDeals] = useState(initialDeals);
  const [filters, setFilters] = useState<DealFiltersState>(DEFAULT_FILTERS);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [grabbedDealId, setGrabbedDealId] = useState<string | null>(null);
  const [grabbedPreviewStageId, setGrabbedPreviewStageId] = useState<
    string | null
  >(null);

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
          filters
        )
      ),
    [deals, filters]
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
      void moveDealStageAction(dealId, stageId);
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
            void moveDealStageAction(dealId, previousStageId);
          });
        },
      },
    });
  }

  function handleSetStatus(
    dealId: string,
    status: "aberto" | "ganho" | "perdido"
  ) {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, status } : d))
    );
    startTransition(() => {
      void setDealStatusAction(dealId, status);
    });
    toast.success(
      status === "aberto"
        ? "Negócio reaberto"
        : `Negócio marcado como ${status === "ganho" ? "Ganho" : "Perdido"}`
    );
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

      <DealFiltersBar
        filters={filters}
        onChange={setFilters}
        owners={formProps.owners}
        allTags={formProps.allTags}
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
            const stageDeals = filteredDeals.filter(
              (d) => d.stageId === stage.id
            );
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
                  <span className="text-sm font-semibold">{stage.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {stageDeals.length} · {formatCurrencyBRL(sum.toFixed(2))}
                  </span>
                </div>

                {stageDeals.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    Nenhum negócio nesta etapa.
                  </p>
                ) : (
                  stageDeals.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      otherStages={otherStages}
                      formProps={formProps}
                      onMoveStage={(stageId) => commitMove(deal.id, stageId)}
                      onSetStatus={(status) => handleSetStatus(deal.id, status)}
                      isGrabbed={grabbedDealId === deal.id}
                      grabbedPreviewStageName={
                        grabbedDealId === deal.id
                          ? (stages.find(
                              (s) =>
                                s.id === (grabbedPreviewStageId ?? deal.stageId)
                            )?.name ?? null)
                          : null
                      }
                      draggable
                      onDragStart={() => setDraggedDealId(deal.id)}
                      onDragEnd={() => {
                        setDraggedDealId(null);
                        setDragOverStageId(null);
                      }}
                      onKeyDown={(e) => handleCardKeyDown(e, deal)}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
