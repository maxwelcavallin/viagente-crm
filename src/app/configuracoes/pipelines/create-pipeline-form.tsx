"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPipelineAction, type CreatePipelineState } from "./actions";

const initialState: CreatePipelineState = { status: "idle" };

export function CreatePipelineForm() {
  const [state, formAction, isPending] = useActionState(
    createPipelineAction,
    initialState
  );

  return (
    <form
      key={state.status === "success" ? state.name : "form"}
      action={formAction}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="name">Nome da pipeline</Label>
        <Input id="name" name="name" required />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
      {state.status === "success" && (
        <p className="text-sm text-muted-foreground">
          Pipeline &quot;{state.name}&quot; criada.
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Criando..." : "Criar pipeline"}
      </Button>
    </form>
  );
}
