"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { clonePipelineAction, type ClonePipelineState } from "./actions";

const idleState: ClonePipelineState = { status: "idle" };

export function ClonePipelineDialog({
  pipelineId,
  pipelineName,
}: {
  pipelineId: string;
  pipelineName: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(clonePipelineAction, idleState);

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
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <Copy size={14} strokeWidth={1.75} />
            Clonar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clonar pipeline</DialogTitle>
          <DialogDescription>
            Copia todas as etapas, motivos de perda, distribuição de dono, tarefas automáticas,
            sequências com gatilho de etapa e webhooks de &quot;{pipelineName}&quot; pra uma
            pipeline nova — só o nome muda. Webhooks clonados ganham uma URL e um secret novos;
            você precisa reconfigurar o sistema externo pra apontar pro endpoint novo.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="sourcePipelineId" value={pipelineId} />
          <div className="space-y-2">
            <Label htmlFor="clone-name">Nome da nova pipeline</Label>
            <Input
              id="clone-name"
              name="name"
              required
              defaultValue={`${pipelineName} (cópia)`}
            />
          </div>
          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Clonando..." : "Clonar pipeline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
