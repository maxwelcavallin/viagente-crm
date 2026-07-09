"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStageAction, type StageFormState } from "./actions";

const initialState: StageFormState = { status: "idle" };

export function CreateStageForm({ pipelineId }: { pipelineId: string }) {
  const [state, formAction, isPending] = useActionState(
    createStageAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="pipelineId" value={pipelineId} />
      <div className="space-y-2">
        <Label htmlFor="stage-name">Nome da etapa</Label>
        <Input id="stage-name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="stage-color">Cor</Label>
        <Input
          id="stage-color"
          name="color"
          type="color"
          defaultValue="#64748b"
          className="h-8 w-16 p-1"
        />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Criando..." : "Criar etapa"}
      </Button>
    </form>
  );
}
