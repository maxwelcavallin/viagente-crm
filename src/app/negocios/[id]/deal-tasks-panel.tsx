"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ListTodo, MessageSquare, Phone, CalendarClock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageTaskExecutor, SchedulingTaskExecutor, type TaskLike } from "@/components/task-executors";
import { addStageTaskToDealAction, completeTaskAction } from "../actions";

export type DealTask = TaskLike;

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
