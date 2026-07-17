"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
import { deletePipelineAction, type DeletePipelineState } from "./actions";

const idleState: DeletePipelineState = { status: "idle" };

export function DeletePipelineDialog({
  pipelineId,
  pipelineName,
}: {
  pipelineId: string;
  pipelineName: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(deletePipelineAction, idleState);

  useEffect(() => {
    if (state.status !== "success") return;
    const timeout = setTimeout(() => {
      setOpen(false);
      router.refresh();
    }, 0);
    return () => clearTimeout(timeout);
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Excluir pipeline"
            className="text-destructive hover:text-destructive"
          />
        }
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir a pipeline &quot;{pipelineName}&quot;?</DialogTitle>
          <DialogDescription>
            Apaga as etapas, motivos de perda, distribuição de dono, tarefas automáticas,
            sequências e webhooks ligados a ela. Só é possível se não houver nenhum negócio nesta
            pipeline — mova ou exclua os negócios antes.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="pipelineId" value={pipelineId} />
          {state.status === "error" && (
            <p className="pb-2 text-sm text-destructive">{state.message}</p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
