"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { renamePipelineAction, type RenamePipelineState } from "./actions";

const idleState: RenamePipelineState = { status: "idle" };

export function RenamePipelineDialog({
  pipelineId,
  pipelineName,
}: {
  pipelineId: string;
  pipelineName: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(renamePipelineAction, idleState);

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
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Renomear pipeline" />
        }
      >
        <Pencil size={14} strokeWidth={1.75} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear pipeline</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="pipelineId" value={pipelineId} />
          <div className="space-y-2">
            <Label htmlFor="rename-name">Nome</Label>
            <Input id="rename-name" name="name" required defaultValue={pipelineName} />
          </div>
          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
