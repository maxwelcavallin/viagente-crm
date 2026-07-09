"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { TagOption } from "@/lib/tags";

const STATUS_LABELS: Record<"aberto" | "ganho" | "perdido", string> = {
  aberto: "Aberto",
  ganho: "Ganho",
  perdido: "Perdido",
};

function ActionMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" />}>
        {label}
        <ChevronDown size={14} strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BulkActionsBar({
  count,
  stages,
  owners,
  allTags,
  onMoveStage,
  onSetOwner,
  onAddTag,
  onSetStatus,
  onDelete,
  onClear,
}: {
  count: number;
  stages: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  allTags: TagOption[];
  onMoveStage: (stageId: string) => void;
  onSetOwner: (ownerId: string | null) => void;
  onAddTag: (tagId: string) => void;
  onSetStatus: (status: "aberto" | "ganho" | "perdido") => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    await onDelete();
    setIsDeleting(false);
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-card p-2.5 shadow-sm">
      <span className="px-1 text-sm font-medium">
        {count} selecionado{count === 1 ? "" : "s"}
      </span>

      <ActionMenu label="Mover para...">
        {stages.map((stage) => (
          <DropdownMenuItem key={stage.id} onClick={() => onMoveStage(stage.id)}>
            {stage.name}
          </DropdownMenuItem>
        ))}
      </ActionMenu>

      <ActionMenu label="Definir dono...">
        <DropdownMenuItem onClick={() => onSetOwner(null)}>Sem dono</DropdownMenuItem>
        {owners.map((owner) => (
          <DropdownMenuItem key={owner.id} onClick={() => onSetOwner(owner.id)}>
            {owner.name}
          </DropdownMenuItem>
        ))}
      </ActionMenu>

      <ActionMenu label="Adicionar tag...">
        {allTags.length === 0 ? (
          <DropdownMenuItem disabled>Nenhuma tag cadastrada</DropdownMenuItem>
        ) : (
          allTags.map((tag) => (
            <DropdownMenuItem key={tag.id} onClick={() => onAddTag(tag.id)}>
              {tag.name}
            </DropdownMenuItem>
          ))
        )}
      </ActionMenu>

      <ActionMenu label="Status...">
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <DropdownMenuItem
            key={value}
            onClick={() => onSetStatus(value as "aberto" | "ganho" | "perdido")}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </ActionMenu>

      <Dialog>
        <DialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
          Excluir
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Excluir {count} negócio{count === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>Essa ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Cancelar seleção"
        onClick={onClear}
        className="ml-auto"
      >
        <X size={16} strokeWidth={1.75} />
      </Button>
    </div>
  );
}
