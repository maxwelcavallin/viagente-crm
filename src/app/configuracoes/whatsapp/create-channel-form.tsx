"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createChannelAction, type ChannelFormState } from "./actions";

const initialState: ChannelFormState = { status: "idle" };

export function CreateChannelForm() {
  const [state, formAction, isPending] = useActionState(
    createChannelAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="label">Nome do canal</Label>
        <Input id="label" name="label" placeholder="Comercial, Suporte..." required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Número (opcional)</Label>
        <Input id="phoneNumber" name="phoneNumber" placeholder="5511999999999" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="zapiInstanceId">Z-API Instance ID</Label>
        <Input id="zapiInstanceId" name="zapiInstanceId" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="zapiToken">Z-API Token (da instância)</Label>
        <Input id="zapiToken" name="zapiToken" type="password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="zapiClientToken">Z-API Client-Token (da conta)</Label>
        <Input id="zapiClientToken" name="zapiClientToken" type="password" required />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando..." : "Adicionar canal"}
      </Button>
    </form>
  );
}
