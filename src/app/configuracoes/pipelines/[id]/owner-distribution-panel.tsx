"use client";

import { useActionState, useState } from "react";
import { UserX, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createOwnerDistributionAction,
  deleteOwnerDistributionAction,
  type OwnerDistributionFormState,
} from "./actions";

export type OwnerDistributionRow = {
  id: string;
  userId: string;
  userName: string;
  weight: number;
  assignedCount: number;
};

const idleState: OwnerDistributionFormState = { status: "idle" };

function DeleteDistributionButton({
  row,
  pipelineId,
}: {
  row: OwnerDistributionRow;
  pipelineId: string;
}) {
  const [, formAction, isPending] = useActionState(
    deleteOwnerDistributionAction,
    idleState
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="pipelineId" value={pipelineId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label={`Remover ${row.userName} da distribuição`}
        disabled={isPending}
      >
        <XCircle size={14} strokeWidth={1.75} />
      </Button>
    </form>
  );
}

export function OwnerDistributionPanel({
  pipelineId,
  rows,
  availableUsers,
}: {
  pipelineId: string;
  rows: OwnerDistributionRow[];
  availableUsers: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    createOwnerDistributionAction,
    idleState
  );
  const usersNotYetAdded = availableUsers.filter(
    (u) => !rows.some((r) => r.userId === u.id)
  );
  const [userId, setUserId] = useState<string | null>(usersNotYetAdded[0]?.id ?? null);

  const totalWeight = rows.reduce((acc, r) => acc + r.weight, 0);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Quando um negócio é criado nesta pipeline sem dono explícito (manual, webhook ou
        importação), o sistema atribui automaticamente seguindo essa proporção. Sem
        regras aqui, o negócio fica sem dono, como hoje.
      </p>
      {rows.length === 0 ? (
        <EmptyState
          icon={UserX}
          title="Nenhuma regra de distribuição"
          description="Adicione usuários e pesos pelo formulário abaixo."
        />
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5 text-sm"
            >
              <span>{row.userName}</span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {totalWeight > 0 ? Math.round((row.weight / totalWeight) * 100) : 0}%
                </span>
                <span>{row.assignedCount} recebido(s)</span>
                <DeleteDistributionButton row={row} pipelineId={pipelineId} />
              </div>
            </div>
          ))}
        </div>
      )}
      {usersNotYetAdded.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Todos os usuários já estão na distribuição desta pipeline.
        </p>
      ) : (
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="pipelineId" value={pipelineId} />
          <input type="hidden" name="userId" value={userId ?? ""} />
          <div className="space-y-1">
            <Label className="text-xs">Usuário</Label>
            <Select
              items={Object.fromEntries(usersNotYetAdded.map((u) => [u.id, u.name]))}
              value={userId}
              onValueChange={setUserId}
            >
              <SelectTrigger className="h-8 w-44 text-sm">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {usersNotYetAdded.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`weight-${pipelineId}`} className="text-xs">
              Peso
            </Label>
            <Input
              id={`weight-${pipelineId}`}
              name="weight"
              type="number"
              min={1}
              defaultValue={1}
              className="h-8 w-20 text-sm"
            />
          </div>
          <Button type="submit" size="sm" disabled={isPending || !userId}>
            {isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </form>
      )}
      {state.status === "error" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
    </div>
  );
}
