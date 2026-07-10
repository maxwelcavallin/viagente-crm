"use client";

import { useActionState } from "react";
import { X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  createLossReasonAction,
  deleteLossReasonAction,
  type LossReasonFormState,
} from "./actions";

export type LossReason = { id: string; label: string };

const idleState: LossReasonFormState = { status: "idle" };

function DeleteLossReasonButton({
  reason,
  pipelineId,
}: {
  reason: LossReason;
  pipelineId: string;
}) {
  const [, formAction, isPending] = useActionState(
    deleteLossReasonAction,
    idleState
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={reason.id} />
      <input type="hidden" name="pipelineId" value={pipelineId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label={`Excluir motivo "${reason.label}"`}
        disabled={isPending}
      >
        <XCircle size={14} strokeWidth={1.75} />
      </Button>
    </form>
  );
}

export function LossReasonsPanel({
  pipelineId,
  reasons,
}: {
  pipelineId: string;
  reasons: LossReason[];
}) {
  const [state, formAction, isPending] = useActionState(
    createLossReasonAction,
    idleState
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Motivos disponíveis ao marcar um negócio desta pipeline como Perdido — usados
        no indicador &quot;Motivos de perda&quot; da página Início.
      </p>
      {reasons.length === 0 ? (
        <EmptyState
          icon={X}
          title="Nenhum motivo cadastrado"
          description="Adicione o primeiro pelo formulário abaixo."
        />
      ) : (
        <div className="space-y-1.5">
          {reasons.map((reason) => (
            <div
              key={reason.id}
              className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5 text-sm"
            >
              <span>{reason.label}</span>
              <DeleteLossReasonButton reason={reason} pipelineId={pipelineId} />
            </div>
          ))}
        </div>
      )}
      <form action={formAction} className="flex items-end gap-2">
        <input type="hidden" name="pipelineId" value={pipelineId} />
        <div className="flex-1 space-y-1">
          <Input
            name="label"
            placeholder="Ex: Preço, Sem resposta, Escolheu concorrente..."
            className="h-8 text-sm"
            required
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Adicionando..." : "Adicionar"}
        </Button>
      </form>
      {state.status === "error" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
    </div>
  );
}
