"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ListTodo, MessageCircle, MoreVertical, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkLostDialog } from "@/components/mark-lost-dialog";
import { cn } from "@/lib/utils";
import {
  formatCurrencyBRL,
  formatMessagePreviewDate,
  formatTimeInStage,
  messagePreviewLabel,
  type DealMessagePreview,
} from "@/lib/deal-format";
import {
  TEMPERATURE_BADGE_VARIANT,
  TEMPERATURE_LABELS,
  type Temperature,
} from "@/lib/temperature";
import type { TagOption } from "@/lib/tags";
import { DealFormDialog, type DealFormProps } from "./deal-form-dialog";
import { DeleteDealDialog } from "./delete-deal-dialog";

export type DealCardData = {
  id: string;
  title: string;
  value: string | null;
  status: "aberto" | "ganho" | "perdido";
  temperature: Temperature | null;
  updatedAt: Date;
  createdAt: Date;
  stageEnteredAt: Date;
  contactId: string;
  contactName: string;
  contactPhone: string;
  ownerId: string | null;
  ownerName: string | null;
  tags: TagOption[];
  customFields: Record<string, unknown>;
  stageId: string;
  pipelineId: string;
  messagePreview: DealMessagePreview | null;
  pendingTaskCount: number;
};

export function DealCard({
  deal,
  otherStages,
  formProps,
  lossReasons,
  onMoveStage,
  onSetStatus,
  onSetLost,
  isGrabbed,
  grabbedPreviewStageName,
  draggable,
  onDragStart,
  onDragEnd,
  onKeyDown,
  selected,
  onToggleSelect,
}: {
  deal: DealCardData;
  otherStages: { id: string; name: string }[];
  formProps: DealFormProps;
  lossReasons: { id: string; label: string }[];
  onMoveStage: (stageId: string) => void;
  onSetStatus: (status: "aberto" | "ganho") => void;
  onSetLost: (lossReasonId: string) => void;
  isGrabbed: boolean;
  grabbedPreviewStageName?: string | null;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const isInactive = deal.status !== "aberto";
  const value = formatCurrencyBRL(deal.value);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      tabIndex={0}
      role="button"
      onKeyDown={onKeyDown}
      aria-label={
        isGrabbed
          ? `Negócio "${deal.title}" selecionado — use as setas pra mover entre colunas, Espaço pra soltar, Esc pra cancelar`
          : `Negócio "${deal.title}" — Espaço pra selecionar e mover`
      }
      className={cn(
        "cursor-grab space-y-2 rounded-xl border border-border bg-card p-3 text-sm transition-all active:cursor-grabbing",
        "hover:border-primary/60",
        isGrabbed && "scale-[1.02] border-primary ring-2 ring-ring/20",
        selected && "border-primary ring-2 ring-primary/30",
        isInactive && "opacity-60"
      )}
    >
      {isGrabbed && (
        <p className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
          Mover para &quot;{grabbedPreviewStageName}&quot; — ← → escolhe,
          Enter confirma, Esc cancela
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            aria-label={selected ? "Remover da seleção" : "Selecionar negócio"}
            aria-pressed={selected}
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:border-primary/60"
            )}
          >
            {selected && <Check size={11} strokeWidth={2.5} />}
          </button>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {deal.contactName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <Link
              href={`/negocios/${deal.id}`}
              className="block truncate font-medium hover:underline"
            >
              {deal.title}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {deal.contactName}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Link
            href={`/atendimento/${deal.contactId}`}
            aria-label="Abrir conversa"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MessageCircle size={14} strokeWidth={1.75} />
          </Link>
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
              customFields: deal.customFields,
              tagIds: deal.tags.map((t) => t.id),
            }}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Editar negócio"
              />
            }
            triggerLabel={<Pencil size={14} strokeWidth={1.75} />}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Mais ações"
                />
              }
            >
              <MoreVertical size={14} strokeWidth={1.75} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {deal.status !== "ganho" && (
                <DropdownMenuItem onClick={() => onSetStatus("ganho")}>
                  Marcar como Ganho
                </DropdownMenuItem>
              )}
              {deal.status !== "perdido" && (
                <DropdownMenuItem onClick={() => setLostDialogOpen(true)}>
                  Marcar como Perdido
                </DropdownMenuItem>
              )}
              {deal.status !== "aberto" && (
                <DropdownMenuItem onClick={() => onSetStatus("aberto")}>
                  Reabrir negócio
                </DropdownMenuItem>
              )}
              {otherStages.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {otherStages.map((stage) => (
                    <DropdownMenuItem
                      key={stage.id}
                      onClick={() => onMoveStage(stage.id)}
                    >
                      Mover para &quot;{stage.name}&quot;
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {deal.messagePreview && (
        <div className="space-y-0.5 rounded-md bg-muted/50 px-2 py-1">
          <p className="text-[10px] font-medium text-muted-foreground">
            {deal.messagePreview.direction === "saida" ? "Você" : deal.contactName}
          </p>
          <p className="line-clamp-1 text-xs">
            {messagePreviewLabel(deal.messagePreview)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {formatMessagePreviewDate(deal.messagePreview.createdAt)}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {deal.temperature && (
          <Badge variant={TEMPERATURE_BADGE_VARIANT[deal.temperature]} dot>
            {TEMPERATURE_LABELS[deal.temperature]}
          </Badge>
        )}
        {value && <span className="text-xs font-medium">{value}</span>}
        {deal.pendingTaskCount > 0 && (
          <Badge variant="warning">
            <ListTodo size={11} strokeWidth={1.75} />
            {deal.pendingTaskCount}
          </Badge>
        )}
      </div>

      {deal.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {deal.tags.map((tag) => (
            <Badge key={tag.id} variant="secondary" dot>
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-0.5 text-[11px] text-muted-foreground">
        <span>{formatTimeInStage(deal.stageEnteredAt)} na etapa</span>
        <DeleteDealDialog
          deal={deal}
          trigger={
            <button
              type="button"
              className="rounded-md px-1 py-0.5 hover:text-destructive"
            >
              Excluir
            </button>
          }
        />
      </div>
      <MarkLostDialog
        open={lostDialogOpen}
        onOpenChange={setLostDialogOpen}
        reasons={lossReasons}
        onConfirm={onSetLost}
      />
    </div>
  );
}
