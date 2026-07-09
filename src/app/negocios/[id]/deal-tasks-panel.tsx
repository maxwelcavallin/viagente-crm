"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ListTodo, MessageSquare, Phone, CalendarClock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScheduleMeetingDialog } from "@/components/schedule-meeting-dialog";
import { addStageTaskToDealAction, completeTaskAction } from "../actions";

export type DealTask = {
  id: string;
  title: string;
  type: "mensagem" | "ligacao" | "agendamento" | "generica";
  status: "pendente" | "concluida";
  messagePreview: string | null;
  dueAt: string | null;
};

export type ManualStageTask = {
  id: string;
  title: string;
  type: "mensagem" | "ligacao" | "agendamento" | "generica";
};

function formatDueAt(dueAt: string): string {
  return new Date(dueAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isTaskOverdue(
  dueAt: string | null,
  isDone: boolean,
  now: Date = new Date()
): boolean {
  return !isDone && !!dueAt && new Date(dueAt).getTime() < now.getTime();
}

const TYPE_ICON = {
  mensagem: MessageSquare,
  ligacao: Phone,
  agendamento: CalendarClock,
  generica: ListTodo,
} as const;

const TYPE_LABELS: Record<DealTask["type"], string> = {
  mensagem: "Mensagem",
  ligacao: "Ligação",
  agendamento: "Agendamento",
  generica: "Genérica",
};

function MessageTaskExecutor({
  task,
  dealId,
  contactId,
  channels,
  preselectedChannelId,
  onDone,
}: {
  task: DealTask;
  dealId: string;
  contactId: string;
  channels: { id: string; label: string }[];
  preselectedChannelId: string | null;
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(task.messagePreview ?? "");
  const [channelId, setChannelId] = useState(preselectedChannelId ?? channels[0]?.id ?? "");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!text.trim() || !channelId) return;
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, contactId, message: text.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao enviar mensagem.");
      }
      await completeTaskAction(task.id, dealId);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar mensagem.");
    } finally {
      setIsSending(false);
    }
  }

  if (!expanded) {
    return (
      <Button type="button" size="sm" onClick={() => setExpanded(true)}>
        Executar
      </Button>
    );
  }

  return (
    <div className="mt-2 w-full space-y-2 rounded-md border border-border p-2">
      {channels.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Você não tem acesso a nenhum canal pra enviar esta mensagem.
        </p>
      ) : (
        <>
          <Select
            items={Object.fromEntries(channels.map((c) => [c.id, c.label]))}
            value={channelId}
            onValueChange={(v) => setChannelId(v ?? "")}
          >
            <SelectTrigger className="h-8 w-48 text-sm">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              {channels.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isSending || !text.trim() || !channelId}
              onClick={handleSend}
            >
              {isSending ? "Enviando..." : "Enviar e concluir"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setExpanded(false)}
            >
              Cancelar
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}

function SchedulingTaskExecutor({
  task,
  dealId,
  contactEmail,
  isGoogleConnected,
  onDone,
}: {
  task: DealTask;
  dealId: string;
  contactEmail: string | null;
  isGoogleConnected: boolean;
  onDone: () => void;
}) {
  return (
    <ScheduleMeetingDialog
      dealId={dealId}
      contactEmail={contactEmail}
      isConnected={isGoogleConnected}
      taskId={task.id}
      defaultTitle={task.title}
      trigger={<Button type="button" size="sm" />}
      triggerLabel="Agendar"
      onScheduled={async () => {
        await completeTaskAction(task.id, dealId);
        onDone();
      }}
    />
  );
}

function TaskRow({
  task,
  dealId,
  contactId,
  contactEmail,
  isGoogleConnected,
  channels,
  preselectedChannelId,
  onDone,
}: {
  task: DealTask;
  dealId: string;
  contactId: string;
  contactEmail: string | null;
  isGoogleConnected: boolean;
  channels: { id: string; label: string }[];
  preselectedChannelId: string | null;
  onDone: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const Icon = TYPE_ICON[task.type];
  const isDone = task.status === "concluida";
  const isOverdue = isTaskOverdue(task.dueAt, isDone);

  async function handleComplete() {
    setIsPending(true);
    await completeTaskAction(task.id, dealId);
    setIsPending(false);
    onDone();
  }

  return (
    <div className="flex flex-wrap items-start gap-2 rounded-lg border border-border p-3">
      <Icon
        size={16}
        strokeWidth={1.75}
        className={isDone ? "text-status-success" : "text-muted-foreground"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={isDone ? "text-muted-foreground line-through" : "font-medium"}>
            {task.title}
          </span>
          <Badge variant={isDone ? "success" : "secondary"}>
            {isDone ? "Concluída" : TYPE_LABELS[task.type]}
          </Badge>
          {task.dueAt && (
            <Badge variant={isOverdue ? "danger" : "secondary"}>
              {isOverdue ? "Atrasada — " : "Prazo: "}
              {formatDueAt(task.dueAt)}
            </Badge>
          )}
        </div>
        {!isDone && task.type === "mensagem" && (
          <MessageTaskExecutor
            task={task}
            dealId={dealId}
            contactId={contactId}
            channels={channels}
            preselectedChannelId={preselectedChannelId}
            onDone={onDone}
          />
        )}
        {!isDone && task.type === "agendamento" && (
          <div className="mt-2">
            <SchedulingTaskExecutor
              task={task}
              dealId={dealId}
              contactEmail={contactEmail}
              isGoogleConnected={isGoogleConnected}
              onDone={onDone}
            />
          </div>
        )}
        {!isDone && task.type !== "mensagem" && task.type !== "agendamento" && (
          <div className="mt-2">
            <Button type="button" size="sm" disabled={isPending} onClick={handleComplete}>
              <Check size={14} strokeWidth={1.75} />
              {isPending ? "Concluindo..." : "Marcar como concluída"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddManualTaskRow({
  stageTask,
  dealId,
  onDone,
}: {
  stageTask: ManualStageTask;
  dealId: string;
  onDone: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const Icon = TYPE_ICON[stageTask.type];

  async function handleAdd() {
    setIsPending(true);
    await addStageTaskToDealAction(dealId, stageTask.id);
    setIsPending(false);
    onDone();
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleAdd}
      className="flex items-center gap-2 rounded-lg border border-dashed border-border p-2 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground disabled:opacity-50"
    >
      <Plus size={14} strokeWidth={1.75} />
      <Icon size={14} strokeWidth={1.75} />
      {stageTask.title}
    </button>
  );
}

export function DealTasksPanel({
  dealId,
  contactId,
  contactEmail,
  isGoogleConnected,
  tasks,
  manualStageTasks,
  channels,
  preselectedChannelId,
}: {
  dealId: string;
  contactId: string;
  contactEmail: string | null;
  isGoogleConnected: boolean;
  tasks: DealTask[];
  manualStageTasks: ManualStageTask[];
  channels: { id: string; label: string }[];
  preselectedChannelId: string | null;
}) {
  const router = useRouter();

  const pending = tasks.filter((t) => t.status === "pendente");
  const done = tasks.filter((t) => t.status === "concluida");

  return (
    <div className="space-y-3">
      {tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Nenhuma tarefa ainda"
          description="Tarefas automáticas aparecem aqui quando o negócio entra numa etapa com tarefas configuradas."
        />
      ) : (
        <div className="space-y-2">
          {[...pending, ...done].map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              dealId={dealId}
              contactId={contactId}
              contactEmail={contactEmail}
              isGoogleConnected={isGoogleConnected}
              channels={channels}
              preselectedChannelId={preselectedChannelId}
              onDone={() => router.refresh()}
            />
          ))}
        </div>
      )}
      {manualStageTasks.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Tarefas disponíveis desta etapa
          </p>
          <div className="flex flex-wrap gap-2">
            {manualStageTasks.map((stageTask) => (
              <AddManualTaskRow
                key={stageTask.id}
                stageTask={stageTask}
                dealId={dealId}
                onDone={() => router.refresh()}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
