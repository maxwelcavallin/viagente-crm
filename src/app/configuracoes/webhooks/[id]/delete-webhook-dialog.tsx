"use client";

import { useActionState } from "react";
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
import { deleteWebhookAction, type DeleteWebhookState } from "../actions";

const idle: DeleteWebhookState = { status: "idle" };

export function DeleteWebhookDialog({
  webhook,
  redirectTo,
}: {
  webhook: { id: string; name: string };
  redirectTo?: string;
}) {
  const [state, formAction, isPending] = useActionState(deleteWebhookAction, idle);

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="destructive" />}>
        Excluir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir o webhook &quot;{webhook.name}&quot;?</DialogTitle>
          <DialogDescription>
            Os logs de execução também serão apagados. Essa ação não pode ser
            desfeita.
          </DialogDescription>
        </DialogHeader>
        {state.status === "error" && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <form action={formAction}>
            <input type="hidden" name="id" value={webhook.id} />
            {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
