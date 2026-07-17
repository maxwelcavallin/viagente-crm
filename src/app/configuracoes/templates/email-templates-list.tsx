"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
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
import { EmailTemplateFormDialog, type EmailTemplateData } from "./email-template-form-dialog";
import { deleteEmailTemplateAction, type TemplateFormState } from "./actions";

const idleState: TemplateFormState = { status: "idle" };

export type EmailTemplateRow = EmailTemplateData & { usageCount: number };

function DeleteEmailTemplateDialog({ template }: { template: EmailTemplateRow }) {
  const [state, formAction, isPending] = useActionState(deleteEmailTemplateAction, idleState);

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
                <strong>{template.usageCount}</strong> tarefa(s) automática(s) de etapa usam
                este template — elas ficarão sem template vinculado. Essa ação não pode ser
                desfeita.
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

export function EmailTemplatesList({
  templates,
  variableCatalog,
}: {
  templates: EmailTemplateRow[];
  variableCatalog: TemplateVariableInfo[];
}) {
  if (templates.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="Nenhum template de email cadastrado"
        description="Crie o primeiro template pelo botão acima."
      />
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((template) => (
        <div
          key={template.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium">{template.name}</p>
            <p className="line-clamp-1 text-sm text-muted-foreground">{template.subject}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <EmailTemplateFormDialog
              mode="edit"
              template={template}
              variableCatalog={variableCatalog}
              trigger={<Button type="button" variant="outline" size="sm" />}
              triggerLabel="Editar"
            />
            <DeleteEmailTemplateDialog template={template} />
          </div>
        </div>
      ))}
    </div>
  );
}
