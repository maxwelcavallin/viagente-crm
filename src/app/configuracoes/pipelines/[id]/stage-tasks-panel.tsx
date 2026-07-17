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
import { Switch } from "@/components/ui/switch";
import { DurationPicker, formatMinutesShort } from "@/components/duration-picker";
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
  type: "mensagem" | "ligacao" | "agendamento" | "generica" | "email";
  messageTemplateId: string | null;
  emailTemplateId: string | null;
  daysToComplete: number | null;
  triggerDelayMinutes: number | null;
  isAutomatic: boolean;
  autoSend: boolean;
  autoSendChannelId: string | null;
};

const TYPE_LABELS: Record<StageTask["type"], string> = {
  mensagem: "Mensagem",
  ligacao: "Ligação",
  agendamento: "Agendamento",
  generica: "Genérica",
  email: "Email",
};

const idleState: StageTaskFormState = { status: "idle" };

function EditStageTaskDialog({
  task,
  pipelineId,
  templates,
  emailTemplates,
  channels,
}: {
  task: StageTask;
  pipelineId: string;
  templates: { id: string; name: string }[];
  emailTemplates: { id: string; name: string }[];
  channels: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [messageTemplateId, setMessageTemplateId] = useState<string | null>(
    task.messageTemplateId
  );
  const [emailTemplateId, setEmailTemplateId] = useState<string | null>(
    task.emailTemplateId
  );
  const [isAutomatic, setIsAutomatic] = useState(task.isAutomatic);
  const [autoSend, setAutoSend] = useState(task.autoSend);
  const [autoSendChannelId, setAutoSendChannelId] = useState<string | null>(
    task.autoSendChannelId
  );
  const [triggerDelayMinutes, setTriggerDelayMinutes] = useState(
    task.triggerDelayMinutes ?? 0
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
          <input type="hidden" name="isAutomatic" value={String(isAutomatic)} />
          <input type="hidden" name="autoSend" value={String(autoSend)} />
          <input type="hidden" name="autoSendChannelId" value={autoSendChannelId ?? ""} />
          <input
            type="hidden"
            name="triggerDelayMinutes"
            value={triggerDelayMinutes || ""}
          />
          <div className="space-y-2">
            <Label htmlFor={`title-${task.id}`}>Título</Label>
            <Input id={`title-${task.id}`} name="title" defaultValue={task.title} required />
          </div>
          <div className="space-y-2">
            <Label>Disparar após entrar na etapa</Label>
            <DurationPicker
              idPrefix={`trigger-${task.id}`}
              totalMinutes={triggerDelayMinutes}
              onChange={setTriggerDelayMinutes}
            />
            <p className="text-xs text-muted-foreground">Tudo zerado = cria na hora.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`days-${task.id}`}>Prazo (dias após a tarefa ser criada)</Label>
            <Input
              id={`days-${task.id}`}
              name="daysToComplete"
              type="number"
              min={0}
              placeholder="Ex: 2 — deixe vazio pra sem prazo"
              defaultValue={task.daysToComplete ?? ""}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={`auto-${task.id}`}>Criar automaticamente</Label>
              <p className="text-xs text-muted-foreground">
                Se desligado, fica disponível pra adicionar manualmente no negócio.
              </p>
            </div>
            <Switch
              id={`auto-${task.id}`}
              checked={isAutomatic}
              onCheckedChange={setIsAutomatic}
            />
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
          {task.type === "email" && (
            <div className="space-y-2">
              <Label>Template de email (opcional)</Label>
              <input type="hidden" name="emailTemplateId" value={emailTemplateId ?? ""} />
              <Select
                items={Object.fromEntries(emailTemplates.map((t) => [t.id, t.name]))}
                value={emailTemplateId}
                onValueChange={(v) => setEmailTemplateId(v ?? null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {emailTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {task.type === "mensagem" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor={`autosend-${task.id}`}>
                    Enviar automaticamente, sem clique
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    A mensagem sai sozinha assim que a tarefa é criada (ou quando o
                    prazo vencer, se houver).
                  </p>
                </div>
                <Switch
                  id={`autosend-${task.id}`}
                  checked={autoSend}
                  onCheckedChange={setAutoSend}
                />
              </div>
              {autoSend && (
                <div className="space-y-2">
                  <Label>Canal WhatsApp</Label>
                  <Select
                    items={Object.fromEntries(channels.map((c) => [c.id, c.label]))}
                    value={autoSendChannelId}
                    onValueChange={(v) => setAutoSendChannelId(v ?? null)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione um canal" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
  emailTemplates,
  channels,
}: {
  stageId: string;
  pipelineId: string;
  templates: { id: string; name: string }[];
  emailTemplates: { id: string; name: string }[];
  channels: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(
    createStageTaskAction,
    idleState
  );
  const [type, setType] = useState<StageTask["type"]>("mensagem");
  const [messageTemplateId, setMessageTemplateId] = useState<string | null>(
    null
  );
  const [emailTemplateId, setEmailTemplateId] = useState<string | null>(null);
  const [isAutomatic, setIsAutomatic] = useState(true);
  const [autoSend, setAutoSend] = useState(false);
  const [autoSendChannelId, setAutoSendChannelId] = useState<string | null>(null);
  const [triggerDelayMinutes, setTriggerDelayMinutes] = useState(0);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="stageId" value={stageId} />
      <input type="hidden" name="pipelineId" value={pipelineId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="isAutomatic" value={String(isAutomatic)} />
      <input type="hidden" name="autoSend" value={String(autoSend)} />
      <input type="hidden" name="autoSendChannelId" value={autoSendChannelId ?? ""} />
      <input
        type="hidden"
        name="triggerDelayMinutes"
        value={triggerDelayMinutes || ""}
      />
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
      {type === "email" && (
        <div className="space-y-1">
          <Label className="text-xs">Template de email</Label>
          <input type="hidden" name="emailTemplateId" value={emailTemplateId ?? ""} />
          <Select
            items={Object.fromEntries(emailTemplates.map((t) => [t.id, t.name]))}
            value={emailTemplateId}
            onValueChange={(v) => setEmailTemplateId(v ?? null)}
          >
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              {emailTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
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
      <div className="space-y-1">
        <Label className="text-xs">Disparar após</Label>
        <DurationPicker
          idPrefix={`new-trigger-${stageId}`}
          totalMinutes={triggerDelayMinutes}
          onChange={setTriggerDelayMinutes}
          size="sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`new-days-${stageId}`} className="text-xs">
          Prazo (dias)
        </Label>
        <Input
          id={`new-days-${stageId}`}
          name="daysToComplete"
          type="number"
          min={0}
          placeholder="Sem prazo"
          className="h-8 w-24 text-sm"
        />
      </div>
      <div className="flex items-center gap-1.5 pb-1.5">
        <Switch
          id={`new-auto-${stageId}`}
          size="sm"
          checked={isAutomatic}
          onCheckedChange={setIsAutomatic}
        />
        <Label htmlFor={`new-auto-${stageId}`} className="text-xs">
          Automática
        </Label>
      </div>
      {type === "mensagem" && (
        <div className="flex items-center gap-1.5 pb-1.5">
          <Switch
            id={`new-autosend-${stageId}`}
            size="sm"
            checked={autoSend}
            onCheckedChange={setAutoSend}
          />
          <Label htmlFor={`new-autosend-${stageId}`} className="text-xs">
            Enviar sozinha
          </Label>
        </div>
      )}
      {type === "mensagem" && autoSend && (
        <div className="space-y-1">
          <Label className="text-xs">Canal</Label>
          <Select
            items={Object.fromEntries(channels.map((c) => [c.id, c.label]))}
            value={autoSendChannelId}
            onValueChange={(v) => setAutoSendChannelId(v ?? null)}
          >
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {channels.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
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
  emailTemplates,
  channels,
}: {
  stageId: string;
  pipelineId: string;
  tasks: StageTask[];
  templates: { id: string; name: string }[];
  emailTemplates: { id: string; name: string }[];
  channels: { id: string; label: string }[];
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
        Tarefas desta etapa ({tasks.length})
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {tasks.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title="Nenhuma tarefa configurada"
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
                {task.triggerDelayMinutes != null && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Disparo: +{formatMinutesShort(task.triggerDelayMinutes)}
                  </span>
                )}
                {task.daysToComplete != null && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Prazo: {task.daysToComplete}d
                  </span>
                )}
                {!task.isAutomatic && (
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    Manual
                  </span>
                )}
                {task.autoSend && (
                  <span className="shrink-0 rounded-full bg-status-success/15 px-2 py-0.5 text-[11px] font-medium text-status-success">
                    Envio automático
                  </span>
                )}
                <div className="flex shrink-0 items-center gap-1.5">
                  <EditStageTaskDialog
                    task={task}
                    pipelineId={pipelineId}
                    templates={templates}
                    emailTemplates={emailTemplates}
                    channels={channels}
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
            emailTemplates={emailTemplates}
            channels={channels}
          />
        </div>
      )}
    </div>
  );
}
