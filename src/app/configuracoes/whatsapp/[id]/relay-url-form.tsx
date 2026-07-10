"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setChannelRelayUrlAction, type RelayUrlFormState } from "./actions";

const idleState: RelayUrlFormState = { status: "idle" };

export function RelayUrlForm({
  channelId,
  defaultValue,
}: {
  channelId: string;
  defaultValue: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    setChannelRelayUrlAction,
    idleState
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="channelId" value={channelId} />
      <div className="min-w-[280px] flex-1 space-y-1">
        <Input
          name="relayWebhookUrl"
          type="url"
          placeholder="https://outro-sistema.com/webhook"
          defaultValue={defaultValue ?? ""}
        />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
      {state.status === "error" && (
        <p className="w-full text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
