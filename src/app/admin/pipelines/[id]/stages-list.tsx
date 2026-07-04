"use client";

import { useActionState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateStageAction,
  deleteStageAction,
  moveStageAction,
  type StageFormState,
} from "./actions";

type Stage = { id: string; name: string; color: string | null };

const idleState: StageFormState = { status: "idle" };

function StageRow({
  stage,
  pipelineId,
  isFirst,
  isLast,
}: {
  stage: Stage;
  pipelineId: string;
  isFirst: boolean;
  isLast: boolean;
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
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          <form action={moveStageAction}>
            <input type="hidden" name="id" value={stage.id} />
            <input type="hidden" name="pipelineId" value={pipelineId} />
            <input type="hidden" name="direction" value="up" />
            <Button
              type="submit"
              variant="outline"
              size="icon-sm"
              disabled={isFirst}
              aria-label="Mover etapa para cima"
            >
              <ArrowUp />
            </Button>
          </form>
          <form action={moveStageAction}>
            <input type="hidden" name="id" value={stage.id} />
            <input type="hidden" name="pipelineId" value={pipelineId} />
            <input type="hidden" name="direction" value="down" />
            <Button
              type="submit"
              variant="outline"
              size="icon-sm"
              disabled={isLast}
              aria-label="Mover etapa para baixo"
            >
              <ArrowDown />
            </Button>
          </form>
        </div>

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

        <form action={deleteAction}>
          <input type="hidden" name="id" value={stage.id} />
          <input type="hidden" name="pipelineId" value={pipelineId} />
          <Button type="submit" variant="destructive" disabled={deletePending}>
            {deletePending ? "Excluindo..." : "Excluir"}
          </Button>
        </form>
      </div>
      {updateState.status === "error" && (
        <p className="text-sm text-destructive">{updateState.message}</p>
      )}
      {deleteState.status === "error" && (
        <p className="text-sm text-destructive">{deleteState.message}</p>
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
  if (stages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma etapa cadastrada ainda.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {stages.map((stage, index) => (
        <StageRow
          key={stage.id}
          stage={stage}
          pipelineId={pipelineId}
          isFirst={index === 0}
          isLast={index === stages.length - 1}
        />
      ))}
    </div>
  );
}
