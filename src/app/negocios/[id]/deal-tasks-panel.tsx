"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ListTodo,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  CalendarClock,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  EmailTaskExecutor,
  MessageTaskExecutor,
  SchedulingTaskExecutor,
  type TaskLike,
} from "@/components/task-executors";
import { EditTaskDialog } from "@/components/edit-task-dialog";
import { DeleteTaskDialog } from "@/components/delete-task-dialog";
import { cn } from "@/lib/utils";
import { addStageTaskToDealAction, completeTaskAction } from "../actions";

export type DealTask = TaskLike;

export type PipelineStageInfo = {
  id: string;
  name: string;
  order: number;
};

// Modelo de tarefa configurado na etapa (Configurações > Pipelines > editar)
// — isAutomatic=true dispara sozinho quando o negócio entra na etapa (ver
// createAutomaticStageTasks); isAutomatic=false só fica disponível pra
// adicionar manualmente (ver addStageTaskToDealAction), de qualquer etapa,
// não só a atual.
export type ManualStageTask = {
  id: string;
  title: string;
  type: "mensagem" | "ligacao" | "agendamento" | "generica" | "email";
};

export type StageTaskConfig = ManualStageTask & {
  stageId: string;
  isAutomatic: boolean;
  order: number;
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
  email: Mail,
} as const;

const TYPE_LABELS: Record<DealTask["type"], string> = {
  mensagem: "Mensagem",
  ligacao: "Ligação",
  agendamento: "Agendamento",
  generica: "Genérica",
  email: "Email",
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
          <div className="ml-auto flex items-center gap-1">
            <EditTaskDialog
              task={task}
              dealId={dealId}
              onDone={onDone}
              trigger={
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar tarefa">
                  <Pencil size={13} strokeWidth={1.75} />
                </Button>
              }
            />
            <DeleteTaskDialog
              task={task}
              dealId={dealId}
              onDone={onDone}
              trigger={
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Excluir tarefa">
                  <Trash2 size={13} strokeWidth={1.75} />
                </Button>
              }
            />
          </div>
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
        {!isDone && task.type === "email" && (
          <div className="mt-2">
            <EmailTaskExecutor
              task={task}
              dealId={dealId}
              contactId={contactId}
              contactEmail={contactEmail}
              onDone={onDone}
            />
          </div>
        )}
        {!isDone &&
          task.type !== "mensagem" &&
          task.type !== "agendamento" &&
          task.type !== "email" && (
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

// Tarefa automática configurada numa etapa que o negócio ainda não
// materializou (etapa futura, ou etapa atual com gatilho por tempo — ver
// triggerDelayMinutes — que o cron ainda não varreu) — só prévia, não é
// executável (dispara sozinha quando chegar a hora).
function AutomaticPreviewRow({ config }: { config: StageTaskConfig }) {
  const Icon = TYPE_ICON[config.type];
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 p-2 text-sm text-muted-foreground opacity-70">
      <Icon size={14} strokeWidth={1.75} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{config.title}</span>
      <Badge variant="secondary">Automática</Badge>
    </div>
  );
}

export function DealTasksPanel({
  dealId,
  contactId,
  contactEmail,
  isGoogleConnected,
  tasks,
  pipelineStages,
  stageTaskConfigs,
  currentStageId,
  channels,
  preselectedChannelId,
}: {
  dealId: string;
  contactId: string;
  contactEmail: string | null;
  isGoogleConnected: boolean;
  tasks: DealTask[];
  pipelineStages: PipelineStageInfo[];
  stageTaskConfigs: StageTaskConfig[];
  currentStageId: string;
  channels: { id: string; label: string }[];
  preselectedChannelId: string | null;
}) {
  const router = useRouter();
  const onDone = () => router.refresh();

  // Tarefa real sem modelo de etapa correspondente (nasceu de automação de
  // tag, sequência, ou o stage_task de origem foi excluído depois) — não tem
  // onde entrar na timeline por etapa, mostra à parte, sempre.
  const configIds = new Set(stageTaskConfigs.map((c) => c.id));
  const ungroupedTasks = tasks.filter(
    (t) => !t.stageTaskId || !configIds.has(t.stageTaskId)
  );
  const ungroupedPending = ungroupedTasks.filter((t) => t.status === "pendente");
  const ungroupedDone = ungroupedTasks.filter((t) => t.status === "concluida");

  // Etapa atual sempre aparece, mesmo sem nenhuma tarefa configurada — é o
  // marcador de "onde o negócio está" na timeline; as demais só entram se
  // tiverem alguma tarefa configurada, senão vira ruído.
  const stagesWithTasks = pipelineStages.filter(
    (stage) => stage.id === currentStageId || stageTaskConfigs.some((c) => c.stageId === stage.id)
  );

  const isEmpty = ungroupedTasks.length === 0 && stagesWithTasks.length === 0;

  return (
    <div className="space-y-4">
      {isEmpty && (
        <EmptyState
          icon={ListTodo}
          title="Nenhuma tarefa ainda"
          description="Tarefas automáticas aparecem aqui quando o negócio entra numa etapa com tarefas configuradas."
        />
      )}

      {ungroupedTasks.length > 0 && (
        <div className="space-y-2">
          {[...ungroupedPending, ...ungroupedDone].map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              dealId={dealId}
              contactId={contactId}
              contactEmail={contactEmail}
              isGoogleConnected={isGoogleConnected}
              channels={channels}
              preselectedChannelId={preselectedChannelId}
              onDone={onDone}
            />
          ))}
        </div>
      )}

      {stagesWithTasks.length > 0 && (
        <div className="space-y-2">
          {stagesWithTasks.map((stage) => {
            const configs = stageTaskConfigs
              .filter((c) => c.stageId === stage.id)
              .sort((a, b) => a.order - b.order);
            const isCurrent = stage.id === currentStageId;

            return (
              <div
                key={stage.id}
                className={cn(
                  "space-y-1.5 rounded-lg border p-2.5",
                  isCurrent ? "border-primary/40 bg-primary/5" : "border-border"
                )}
              >
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold">{stage.name}</p>
                  {isCurrent && <Badge variant="info">Etapa atual</Badge>}
                </div>
                <div className="space-y-1.5">
                  {configs.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma tarefa configurada nesta etapa.
                    </p>
                  )}
                  {configs.map((config) => {
                    const instances = tasks.filter((t) => t.stageTaskId === config.id);
                    if (instances.length > 0) {
                      return instances.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          dealId={dealId}
                          contactId={contactId}
                          contactEmail={contactEmail}
                          isGoogleConnected={isGoogleConnected}
                          channels={channels}
                          preselectedChannelId={preselectedChannelId}
                          onDone={onDone}
                        />
                      ));
                    }
                    if (config.isAutomatic) {
                      return <AutomaticPreviewRow key={config.id} config={config} />;
                    }
                    return (
                      <AddManualTaskRow
                        key={config.id}
                        stageTask={config}
                        dealId={dealId}
                        onDone={onDone}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
