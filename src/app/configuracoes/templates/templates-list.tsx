"use client";

import { useActionState } from "react";
import { FileText, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import type { TemplateVariableInfo } from "@/lib/templates";
import { TemplateFormDialog, type TemplateData } from "./template-form-dialog";
import { deleteTemplateAction, type TemplateFormState } from "./actions";

const idleState: TemplateFormState = { status: "idle" };

export type TemplateRow = TemplateData & { usageCount: number };

function DeleteTemplateDialog({ template }: { template: TemplateRow }) {
  const [state, formAction, isPending] = useActionState(
    deleteTemplateAction,
    idleState
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
        Excluir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir o template &quot;{template.name}&quot;?</DialogTitle>
          <DialogDescription>
            {template.usageCount > 0 ? (
              <>
                <strong>{template.usageCount}</strong> tarefa(s) automática(s)
                de etapa usam este template — elas ficarão sem template
                vinculado. Essa ação não pode ser desfeita.
              </>
            ) : (
              "Essa ação não pode ser desfeita."
            )}
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
            <input type="hidden" name="id" value={template.id} />
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TemplatesList({
  templates,
  variableCatalog,
}: {
  templates: TemplateRow[];
  variableCatalog: TemplateVariableInfo[];
}) {
  if (templates.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nenhum template cadastrado"
        description="Crie o primeiro template pelo botão acima."
      />
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((template) => {
        const hasMedia = template.items.some((it) => it.mediaType);
        const preview = template.items[0]?.content || "";
        return (
          <div
            key={template.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-medium">{template.name}</p>
                {template.items.length > 1 && (
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                    {template.items.length} mensagens
                  </span>
                )}
                {hasMedia && (
                  <Paperclip
                    size={12}
                    strokeWidth={1.75}
                    className="shrink-0 text-muted-foreground"
                    aria-label="Tem anexo"
                  />
                )}
              </div>
              <p className="line-clamp-1 text-sm text-muted-foreground">
                {preview || (hasMedia ? "Anexo" : "—")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <TemplateFormDialog
                mode="edit"
                template={template}
                variableCatalog={variableCatalog}
                trigger={<Button type="button" variant="outline" size="sm" />}
                triggerLabel="Editar"
              />
              <DeleteTemplateDialog template={template} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
