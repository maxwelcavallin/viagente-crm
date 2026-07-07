"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTagAction, type TagFormState } from "./actions";

const initialState: TagFormState = { status: "idle" };

export function CreateTagForm() {
  const [state, formAction, isPending] = useActionState(
    createTagAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="color">Cor</Label>
        <Input id="color" name="color" type="color" defaultValue="#e59501" className="h-8 w-16 p-1" />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Criando..." : "Criar tag"}
      </Button>
    </form>
  );
}
