"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { substituteTemplate, type TemplateVariableInfo } from "@/lib/templates";
import {
  createTemplateAction,
  updateTemplateAction,
  type TemplateFormState,
} from "./actions";

const idleState: TemplateFormState = { status: "idle" };

export type TemplateData = { id: string; name: string; content: string };

export function TemplateFormDialog({
  mode,
  template,
  variableCatalog,
  trigger,
  triggerLabel,
}: {
  mode: "create" | "edit";
  template?: TemplateData;
  variableCatalog: TemplateVariableInfo[];
  trigger: React.ReactElement;
  triggerLabel: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(template?.name ?? "");
  const [content, setContent] = useState(template?.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const action = mode === "create" ? createTemplateAction : updateTemplateAction;

  const exampleValues = useMemo(
    () => Object.fromEntries(variableCatalog.map((v) => [v.key, v.example])),
    [variableCatalog]
  );
  const preview = useMemo(
    () => substituteTemplate(content, exampleValues),
    [content, exampleValues]
  );

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    const result = await action(idleState, formData);
    setIsPending(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo template" : `Editar ${template?.name}`}
          </DialogTitle>
          <DialogDescription>
            Use variáveis no formato <code>{"{{variavel}}"}</code> — a lista
            de variáveis disponíveis está ao lado.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {mode === "edit" && template && (
            <input type="hidden" name="id" value={template.id} />
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo</Label>
              <textarea
                id="content"
                name="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={8}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
              />
              <div className="space-y-1">
                <Label>Preview com dados de exemplo</Label>
                <p className="rounded-lg border border-border bg-muted p-2.5 text-sm whitespace-pre-wrap">
                  {preview || "—"}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Variáveis disponíveis</Label>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {variableCatalog.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setContent((c) => c + `{{${v.key}}}`)}
                    className="block w-full rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
                    title={`Inserir {{${v.key}}}`}
                  >
                    <span className="font-mono text-primary">
                      {`{{${v.key}}}`}
                    </span>
                    <span className="block text-muted-foreground">
                      {v.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Salvando..."
                : mode === "create"
                  ? "Criar template"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
