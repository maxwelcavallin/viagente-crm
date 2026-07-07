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
import { deleteContactAction, type DeleteContactState } from "./actions";

const idle: DeleteContactState = { status: "idle" };

export function DeleteContactDialog({
  contact,
  redirectTo,
  trigger,
}: {
  contact: { id: string; name: string };
  redirectTo?: string;
  trigger?: React.ReactElement;
}) {
  const [state, formAction, isPending] = useActionState(
    deleteContactAction,
    idle
  );

  return (
    <Dialog>
      <DialogTrigger
        render={trigger ?? <Button type="button" variant="destructive" size="sm" />}
      >
        Excluir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir o contato &quot;{contact.name}&quot;?</DialogTitle>
          <DialogDescription>
            Essa ação não pode ser desfeita. Todo o histórico de conversa
            deste contato também será apagado.
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
            <input type="hidden" name="id" value={contact.id} />
            {redirectTo && (
              <input type="hidden" name="redirectTo" value={redirectTo} />
            )}
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
