"use client";

import { useActionState, useState, useTransition } from "react";
import { GripVertical, ListChecks, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  updateFieldAction,
  deleteFieldAction,
  moveFieldAction,
  reorderFieldsAction,
  type FieldFormState,
} from "./actions";

export type FieldOption = { value: string; label: string };

export type FieldRowData = {
  id: string;
  key: string;
  label: string;
  type: "texto" | "numero" | "select" | "data";
  options: FieldOption[] | null;
  order: number;
  usageCount: number;
};

const TYPE_LABELS: Record<FieldRowData["type"], string> = {
  texto: "Texto",
  numero: "Número",
  select: "Select",
  data: "Data",
};

const idleState: FieldFormState = { status: "idle" };

function OptionsEditor({
  options,
  onChange,
}: {
  options: FieldOption[];
  onChange: (options: FieldOption[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Opções</Label>
      <input type="hidden" name="options" value={JSON.stringify(options)} />
      <div className="space-y-2">
        {options.map((opt, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              placeholder="Label"
              value={opt.label}
              onChange={(e) =>
                onChange(
                  options.map((o, i) =>
                    i === index ? { ...o, label: e.target.value } : o
                  )
                )
              }
              className="flex-1"
            />
            <Input
              placeholder="valor_interno"
              value={opt.value}
              onChange={(e) =>
                onChange(
                  options.map((o, i) =>
                    i === index ? { ...o, value: e.target.value } : o
                  )
                )
              }
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remover opção"
              onClick={() => onChange(options.filter((_, i) => i !== index))}
            >
              <X size={14} strokeWidth={1.75} />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...options, { value: "", label: "" }])}
      >
        <Plus size={14} strokeWidth={1.75} />
        Adicionar opção
      </Button>
    </div>
  );
}

function EditFieldDialog({ field }: { field: FieldRowData }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(field.label);
  const [options, setOptions] = useState<FieldOption[]>(field.options ?? []);
  const [state, formAction, isPending] = useActionState(
    updateFieldAction,
    idleState
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Editar
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar campo &quot;{field.label}&quot;</DialogTitle>
          <DialogDescription>
            Chave <code className="font-mono">{field.key}</code> e tipo (
            {TYPE_LABELS[field.type]}) não podem ser alterados depois de
            criados. Crie um campo novo se precisar de outro tipo.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={field.id} />
          <div className="space-y-2">
            <Label htmlFor={`label-${field.id}`}>Label</Label>
            <Input
              id={`label-${field.id}`}
              name="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>
          {field.type === "select" && (
            <OptionsEditor options={options} onChange={setOptions} />
          )}
          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteFieldDialog({ field }: { field: FieldRowData }) {
  const [deleteState, deleteAction, isPending] = useActionState(
    deleteFieldAction,
    idleState
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
        Excluir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir o campo &quot;{field.label}&quot;?</DialogTitle>
          <DialogDescription>
            {field.usageCount > 0 ? (
              <>
                <strong>{field.usageCount}</strong> registro(s) têm dado
                preenchido neste campo. Excluir o campo torna esse dado
                inacessível pelo CRM — essa ação não pode ser desfeita.
              </>
            ) : (
              "Essa ação não pode ser desfeita."
            )}
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
            <input type="hidden" name="id" value={field.id} />
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({
  field,
  index,
  total,
  entity,
  isDragging,
  isDropTarget,
  isGrabbed,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onHandleKeyDown,
}: {
  field: FieldRowData;
  index: number;
  total: number;
  entity: "contact" | "deal";
  isDragging: boolean;
  isDropTarget: boolean;
  isGrabbed: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onHandleKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 transition-all",
        isDragging && "scale-[1.02] border-primary opacity-60",
        isDropTarget && "border-2 border-dashed border-primary",
        isGrabbed && "border-primary ring-2 ring-ring/20"
      )}
    >
      <button
        type="button"
        tabIndex={0}
        onKeyDown={onHandleKeyDown}
        aria-label={
          isGrabbed
            ? "Campo selecionado — use as setas pra mover, Espaço pra soltar, Esc pra cancelar"
            : "Segurar campo pra reordenar"
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
              aria-label="Mover campo"
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
              formData.set("id", field.id);
              formData.set("entity", entity);
              formData.set("direction", "up");
              moveFieldAction(formData);
            }}
          >
            Mover para cima
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={index === total - 1}
            onClick={() => {
              const formData = new FormData();
              formData.set("id", field.id);
              formData.set("entity", entity);
              formData.set("direction", "down");
              moveFieldAction(formData);
            }}
          >
            Mover para baixo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex min-w-[180px] flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium">{field.label}</span>
          <Badge variant="secondary">{TYPE_LABELS[field.type]}</Badge>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {field.key}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <EditFieldDialog field={field} />
        <DeleteFieldDialog field={field} />
      </div>
    </div>
  );
}

export function FieldsList({
  entity,
  fields,
}: {
  entity: "contact" | "deal";
  fields: FieldRowData[];
}) {
  const [order, setOrder] = useState(fields);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function commitOrder(newOrder: FieldRowData[]) {
    const previous = order;
    setOrder(newOrder);
    startTransition(() => {
      void reorderFieldsAction(
        entity,
        newOrder.map((f) => f.id)
      );
    });
    toast.success("Ordem dos campos atualizada", {
      duration: 5000,
      action: {
        label: "Desfazer",
        onClick: () => {
          setOrder(previous);
          startTransition(() => {
            void reorderFieldsAction(
              entity,
              previous.map((f) => f.id)
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

    const fromIndex = order.findIndex((f) => f.id === currentDraggedId);
    if (fromIndex === -1 || fromIndex === dropIndex) return;

    const newOrder = [...order];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(dropIndex, 0, moved);
    commitOrder(newOrder);
  }

  function handleHandleKeyDown(e: React.KeyboardEvent, id: string) {
    const index = order.findIndex((f) => f.id === id);
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
      setOrder(fields);
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
        icon={ListChecks}
        title="Nenhum campo cadastrado"
        description="Crie o primeiro campo pelo formulário ao lado."
      />
    );
  }

  return (
    <div className="space-y-3">
      {order.map((field, index) => (
        <FieldRow
          key={field.id}
          field={field}
          entity={entity}
          index={index}
          total={order.length}
          isDragging={draggedId === field.id}
          isDropTarget={overIndex === index && draggedId !== field.id}
          isGrabbed={grabbedId === field.id}
          onDragStart={() => setDraggedId(field.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIndex(index);
          }}
          onDrop={() => handleDrop(index)}
          onDragEnd={() => {
            setDraggedId(null);
            setOverIndex(null);
          }}
          onHandleKeyDown={(e) => handleHandleKeyDown(e, field.id)}
        />
      ))}
    </div>
  );
}
