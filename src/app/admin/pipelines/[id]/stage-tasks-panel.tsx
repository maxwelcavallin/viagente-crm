"use client";

import { useActionState, useState } from "react";
import { GripVertical, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createStageTaskAction,
  deleteStageTaskAction,
  moveStageTaskAction,
  updateStageTaskAction,
  type StageTaskFormState,
} from "./actions";

export type StageTask = {
  id: string;
  title: string;
  type: "mensagem" | "ligacao" | "agendamento" | "generica";
  messageTemplateId: string | null;
};

const TYPE_LABELS: Record<StageTask["type"], string> = {
  mensagem: "Mensagem",
  ligacao: "Ligação",
  agendamento: "Agendamento",
  generica: "Genérica",
};

const idleState: StageTaskFormState = { status: "idle" };

function EditStageTaskDialog({
  task,
  pipelineId,
  templates,
}: {
  task: StageTask;
  pipelineId: string;
  templates: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [messageTemplateId, setMessageTemplateId] = useState<string | null>(
    task.messageTemplateId
  );
  const [state, formAction, isPending] = useActionState(
    updateStageTaskAction,
    idleState
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Editar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar tarefa &quot;{task.title}&quot;</DialogTitle>
          <DialogDescription>
            Tipo ({TYPE_LABELS[task.type]}) não pode ser alterado depois de
            criado.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="pipelineId" value={pipelineId} />
          <div className="space-y-2">
            <Label htmlFor={`title-${task.id}`}>Título</Label>
            <Input id={`title-${task.id}`} name="title" defaultValue={task.title} required />
          </div>
          {task.type === "mensagem" && (
            <div className="space-y-2">
              <Label>Template</Label>
              <input
                type="hidden"
                name="messageTemplateId"
                value={messageTemplateId ?? ""}
              />
              <Select
                items={Object.fromEntries(templates.map((t) => [t.id, t.name]))}
                value={messageTemplateId}
                onValueChange={(v) => setMessageTemplateId(v ?? null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteStageTaskDialog({
  task,
  pipelineId,
}: {
  task: StageTask;
  pipelineId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    deleteStageTaskAction,
    idleState
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
        Excluir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir a tarefa &quot;{task.title}&quot;?</DialogTitle>
          <DialogDescription>
            Negócios que já ganharam essa tarefa não são afetados. Essa ação
            não pode ser desfeita.
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
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="pipelineId" value={pipelineId} />
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateStageTaskForm({
  stageId,
  pipelineId,
  templates,
}: {
  stageId: string;
  pipelineId: string;
  templates: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    createStageTaskAction,
    idleState
  );
  const [type, setType] = useState<StageTask["type"]>("mensagem");
  const [messageTemplateId, setMessageTemplateId] = useState<string | null>(
    null
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="stageId" value={stageId} />
      <input type="hidden" name="pipelineId" value={pipelineId} />
      <input type="hidden" name="type" value={type} />
      <div className="space-y-1">
        <Label htmlFor={`new-title-${stageId}`} className="text-xs">
          Título
        </Label>
        <Input
          id={`new-title-${stageId}`}
          name="title"
          placeholder="Ex: Enviar boas-vindas"
          className="h-8 w-48 text-sm"
          required
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Tipo</Label>
        <Select
          items={TYPE_LABELS}
          value={type}
          onValueChange={(v) => setType((v as StageTask["type"]) ?? "mensagem")}
        >
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {type === "mensagem" && (
        <div className="space-y-1">
          <Label className="text-xs">Template</Label>
          <input
            type="hidden"
            name="messageTemplateId"
            value={messageTemplateId ?? ""}
          />
          <Select
            items={Object.fromEntries(templates.map((t) => [t.id, t.name]))}
            value={messageTemplateId}
            onValueChange={(v) => setMessageTemplateId(v ?? null)}
          >
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Adicionando..." : "Adicionar tarefa"}
      </Button>
      {state.status === "error" && (
        <p className="w-full text-xs text-destructive">{state.message}</p>
      )}
    </form>
  );
}

export function StageTasksPanel({
  stageId,
  pipelineId,
  tasks,
  templates,
}: {
  stageId: string;
  pipelineId: string;
  tasks: StageTask[];
  templates: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 border-t border-border pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ListTodo size={13} strokeWidth={1.75} />
        Tarefas automáticas desta etapa ({tasks.length})
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {tasks.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title="Nenhuma tarefa automática"
              description="Adicione uma tarefa pelo formulário abaixo."
            />
          ) : (
            tasks.map((task, index) => (
              <div
                key={task.id}
                className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-2 text-sm"
              >
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Mover tarefa"
                      />
                    }
                  >
                    <GripVertical size={14} strokeWidth={1.75} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      disabled={index === 0}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("id", task.id);
                        fd.set("stageId", stageId);
                        fd.set("pipelineId", pipelineId);
                        fd.set("direction", "up");
                        moveStageTaskAction(fd);
                      }}
                    >
                      Mover para cima
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={index === tasks.length - 1}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("id", task.id);
                        fd.set("stageId", stageId);
                        fd.set("pipelineId", pipelineId);
                        fd.set("direction", "down");
                        moveStageTaskAction(fd);
                      }}
                    >
                      Mover para baixo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {TYPE_LABELS[task.type]}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <EditStageTaskDialog
                    task={task}
                    pipelineId={pipelineId}
                    templates={templates}
                  />
                  <DeleteStageTaskDialog task={task} pipelineId={pipelineId} />
                </div>
              </div>
            ))
          )}
          <CreateStageTaskForm
            stageId={stageId}
            pipelineId={pipelineId}
            templates={templates}
          />
        </div>
      )}
    </div>
  );
}
