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
import { deleteDealAction, type DeleteDealState } from "./actions";

const idle: DeleteDealState = { status: "idle" };

export function DeleteDealDialog({
  deal,
  redirectTo,
  trigger,
}: {
  deal: { id: string; title: string };
  redirectTo?: string;
  trigger?: React.ReactElement;
}) {
  const [state, formAction, isPending] = useActionState(deleteDealAction, idle);

  return (
    <Dialog>
      <DialogTrigger
        render={trigger ?? <Button type="button" variant="destructive" size="sm" />}
      >
        Excluir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir o negócio &quot;{deal.title}&quot;?</DialogTitle>
          <DialogDescription>Essa ação não pode ser desfeita.</DialogDescription>
        </DialogHeader>
        {state.status === "error" && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <form action={formAction}>
            <input type="hidden" name="id" value={deal.id} />
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
