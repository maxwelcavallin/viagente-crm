"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { GripVertical, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  updateStageAction,
  deleteStageAction,
  moveStageAction,
  reorderStagesAction,
  type StageFormState,
} from "./actions";

type Stage = { id: string; name: string; color: string | null };

const idleState: StageFormState = { status: "idle" };

function StageRow({
  stage,
  pipelineId,
  index,
  total,
  isDragging,
  isDropTarget,
  isGrabbed,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onHandleKeyDown,
}: {
  stage: Stage;
  pipelineId: string;
  index: number;
  total: number;
  isDragging: boolean;
  isDropTarget: boolean;
  isGrabbed: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onHandleKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateStageAction,
    idleState
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteStageAction,
    idleState
  );

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "space-y-2 rounded-lg border border-border p-3 transition-all",
        isDragging && "scale-[1.02] border-primary opacity-60",
        isDropTarget && "border-2 border-dashed border-primary",
        isGrabbed && "border-primary ring-2 ring-ring/20"
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          tabIndex={0}
          onKeyDown={onHandleKeyDown}
          aria-label={
            isGrabbed
              ? "Etapa selecionada — use as setas pra mover, Espaço pra soltar, Esc pra cancelar"
              : "Segurar etapa pra reordenar"
          }
          aria-pressed={isGrabbed}
          className="hidden shrink-0 cursor-grab items-center rounded-md p-1.5 text-muted-foreground hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 active:cursor-grabbing lg:flex"
        >
          <GripVertical size={16} strokeWidth={1.75} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Mover etapa"
              />
            }
          >
            <GripVertical size={16} strokeWidth={1.75} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              disabled={index === 0}
              onClick={() => {
                const formData = new FormData();
                formData.set("id", stage.id);
                formData.set("pipelineId", pipelineId);
                formData.set("direction", "up");
                moveStageAction(formData);
              }}
            >
              Mover para cima
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === total - 1}
              onClick={() => {
                const formData = new FormData();
                formData.set("id", stage.id);
                formData.set("pipelineId", pipelineId);
                formData.set("direction", "down");
                moveStageAction(formData);
              }}
            >
              Mover para baixo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <form
          action={updateAction}
          className="flex flex-1 flex-wrap items-center gap-3"
        >
          <input type="hidden" name="id" value={stage.id} />
          <input type="hidden" name="pipelineId" value={pipelineId} />
          <Input
            name="name"
            defaultValue={stage.name}
            required
            className="min-w-[160px] flex-1"
          />
          <Input
            name="color"
            type="color"
            defaultValue={stage.color ?? "#64748b"}
            className="h-8 w-16 p-1"
          />
          <Button type="submit" variant="secondary" disabled={updatePending}>
            {updatePending ? "Salvando..." : "Salvar"}
          </Button>
        </form>

        <Dialog>
          <DialogTrigger render={<Button type="button" variant="destructive" />}>
            Excluir
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir a etapa &quot;{stage.name}&quot;?</DialogTitle>
              <DialogDescription>
                Essa ação não pode ser desfeita. Se houver negócios nesta
                etapa, a exclusão será bloqueada.
              </DialogDescription>
            </DialogHeader>
            {deleteState.status === "error" && (
              <p className="text-sm text-destructive">{deleteState.message}</p>
            )}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancelar
              </DialogClose>
              <form action={deleteAction}>
                <input type="hidden" name="id" value={stage.id} />
                <input type="hidden" name="pipelineId" value={pipelineId} />
                <Button type="submit" variant="destructive" disabled={deletePending}>
                  {deletePending ? "Excluindo..." : "Confirmar exclusão"}
                </Button>
              </form>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {updateState.status === "error" && (
        <p className="text-sm text-destructive">{updateState.message}</p>
      )}
    </div>
  );
}

export function StagesList({
  stages,
  pipelineId,
}: {
  stages: Stage[];
  pipelineId: string;
}) {
  // O componente é remontado (via `key` no chamador) sempre que a ordem ou
  // o conjunto de etapas muda no servidor, então o estado local não precisa
  // se resincronizar via efeito — evita o padrão desencorajado de
  // setState dentro de useEffect só pra espelhar uma prop.
  const [order, setOrder] = useState(stages);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function commitOrder(newOrder: Stage[]) {
    const previous = order;
    setOrder(newOrder);
    startTransition(() => {
      void reorderStagesAction(
        pipelineId,
        newOrder.map((s) => s.id)
      );
    });
    toast.success("Ordem das etapas atualizada", {
      duration: 5000,
      action: {
        label: "Desfazer",
        onClick: () => {
          setOrder(previous);
          startTransition(() => {
            void reorderStagesAction(
              pipelineId,
              previous.map((s) => s.id)
            );
          });
        },
      },
    });
  }

  function handleDrop(dropIndex: number) {
    setOverIndex(null);
    const currentDraggedId = draggedId;
    setDraggedId(null);
    if (!currentDraggedId) return;

    const fromIndex = order.findIndex((s) => s.id === currentDraggedId);
    if (fromIndex === -1 || fromIndex === dropIndex) return;

    const newOrder = [...order];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(dropIndex, 0, moved);
    commitOrder(newOrder);
  }

  function handleHandleKeyDown(e: React.KeyboardEvent, id: string) {
    const index = order.findIndex((s) => s.id === id);
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (grabbedId === id) {
        setGrabbedId(null);
        commitOrder(order);
      } else {
        setGrabbedId(id);
      }
    } else if (e.key === "Escape" && grabbedId === id) {
      e.preventDefault();
      setOrder(stages);
      setGrabbedId(null);
    } else if (
      grabbedId === id &&
      (e.key === "ArrowUp" || e.key === "ArrowDown")
    ) {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? -1 : 1;
      const newIndex = index + delta;
      if (newIndex < 0 || newIndex >= order.length) return;
      const newOrder = [...order];
      [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
      setOrder(newOrder);
    }
  }

  if (order.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title="Nenhuma etapa cadastrada"
        description="Crie a primeira etapa pelo formulário ao lado."
      />
    );
  }

  return (
    <div className="space-y-3">
      {order.map((stage, index) => (
        <StageRow
          key={stage.id}
          stage={stage}
          pipelineId={pipelineId}
          index={index}
          total={order.length}
          isDragging={draggedId === stage.id}
          isDropTarget={overIndex === index && draggedId !== stage.id}
          isGrabbed={grabbedId === stage.id}
          onDragStart={() => setDraggedId(stage.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIndex(index);
          }}
          onDrop={() => handleDrop(index)}
          onDragEnd={() => {
            setDraggedId(null);
            setOverIndex(null);
          }}
          onHandleKeyDown={(e) => handleHandleKeyDown(e, stage.id)}
        />
      ))}
    </div>
  );
}
