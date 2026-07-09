"use client";

import { useActionState } from "react";
import { Tag as TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  updateTagAction,
  deleteTagAction,
  type TagFormState,
} from "./actions";

export type TagRow = {
  id: string;
  name: string;
  color: string | null;
  usageCount: number;
};

const idleState: TagFormState = { status: "idle" };

function TagRowItem({ tag }: { tag: TagRow }) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateTagAction,
    idleState
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTagAction,
    idleState
  );

  return (
    <TableRow>
      <TableCell>
        <span
          className="inline-block size-3 rounded-full border border-border"
          style={{ backgroundColor: tag.color ?? "var(--muted-foreground)" }}
        />
      </TableCell>
      <TableCell>
        <form action={updateAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={tag.id} />
          <Input name="name" defaultValue={tag.name} required className="min-w-[140px]" />
          <Input
            name="color"
            type="color"
            defaultValue={tag.color ?? "#e59501"}
            className="h-8 w-14 p-1"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={updatePending}>
            {updatePending ? "Salvando..." : "Salvar"}
          </Button>
          {updateState.status === "error" && (
            <p className="w-full text-sm text-destructive">{updateState.message}</p>
          )}
        </form>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{tag.usageCount} em uso</Badge>
      </TableCell>
      <TableCell>
        <Dialog>
          <DialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
            Excluir
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir a tag &quot;{tag.name}&quot;?</DialogTitle>
              <DialogDescription>
                {tag.usageCount > 0 ? (
                  <>
                    Essa tag está atribuída a <strong>{tag.usageCount}</strong>{" "}
                    contato(s)/negócio(s). A associação será removida junto.
                    Essa ação não pode ser desfeita.
                  </>
                ) : (
                  "Essa ação não pode ser desfeita."
                )}
              </DialogDescription>
            </DialogHeader>
            {deleteState.status === "error" && (
              <p className="text-sm text-destructive">{deleteState.message}</p>
            )}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancelar
              </DialogClose>
              <form action={deleteAction}>
                <input type="hidden" name="id" value={tag.id} />
                <Button type="submit" variant="destructive" disabled={deletePending}>
                  {deletePending ? "Excluindo..." : "Confirmar exclusão"}
                </Button>
              </form>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}

export function TagsList({ tags }: { tags: TagRow[] }) {
  if (tags.length === 0) {
    return (
      <EmptyState
        icon={TagIcon}
        title="Nenhuma tag cadastrada"
        description="Crie a primeira tag pelo formulário ao lado."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead />
          <TableHead>Nome / cor</TableHead>
          <TableHead>Uso</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {tags.map((tag) => (
          <TagRowItem key={tag.id} tag={tag} />
        ))}
      </TableBody>
    </Table>
  );
}
