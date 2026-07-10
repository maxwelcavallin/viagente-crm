"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ListTodo, MessageSquare, Pencil, Phone, CalendarClock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageTaskExecutor, SchedulingTaskExecutor, type TaskLike } from "@/components/task-executors";
import { EditTaskDialog } from "@/components/edit-task-dialog";
import { DeleteTaskDialog } from "@/components/delete-task-dialog";
import { completeTaskAction } from "@/app/negocios/actions";

export type TarefaItem = {
  id: string;
  title: string;
  type: "mensagem" | "ligacao" | "agendamento" | "generica";
  status: "pendente" | "concluida";
  dueAt: string | null;
  messagePreview: string | null;
  dealId: string;
  dealTitle: string;
  contactId: string;
  contactName: string;
  contactEmail: string | null;
};

const STATUS_OPTIONS: Record<string, string> = {
  aberto: "Em aberto",
  atrasada: "Atrasadas",
  concluida: "Concluídas",
  todas: "Todas",
};

const TYPE_ICON = {
  mensagem: MessageSquare,
  ligacao: Phone,
  agendamento: CalendarClock,
  generica: ListTodo,
} as const;

const TYPE_LABELS: Record<TarefaItem["type"], string> = {
  mensagem: "Mensagem",
  ligacao: "Ligação",
  agendamento: "Agendamento",
  generica: "Genérica",
};

function formatDueAt(dueAt: string): string {
  return new Date(dueAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(dueAt: string | null, isDone: boolean, now: Date = new Date()): boolean {
  return !isDone && !!dueAt && new Date(dueAt).getTime() < now.getTime();
}

function isSameLocalDate(dueAt: string, dateStr: string): boolean {
  const d = new Date(dueAt);
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return local === dateStr;
}

function TarefaRow({
  item,
  channels,
  preselectedChannelId,
  isGoogleConnected,
  onDone,
}: {
  item: TarefaItem;
  channels: { id: string; label: string }[];
  preselectedChannelId: string | null;
  isGoogleConnected: boolean;
  onDone: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const Icon = TYPE_ICON[item.type];
  const isDone = item.status === "concluida";
  const overdue = isOverdue(item.dueAt, isDone);

  const task: TaskLike = {
    id: item.id,
    title: item.title,
    type: item.type,
    status: item.status,
    messagePreview: item.messagePreview,
    dueAt: item.dueAt,
  };

  async function handleComplete() {
    setIsPending(true);
    await completeTaskAction(item.id, item.dealId);
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
            {item.title}
          </span>
          <Badge variant={isDone ? "success" : "secondary"}>
            {isDone ? "Concluída" : TYPE_LABELS[item.type]}
          </Badge>
          {item.dueAt && (
            <Badge variant={overdue ? "danger" : "secondary"}>
              {overdue ? "Atrasada — " : "Prazo: "}
              {formatDueAt(item.dueAt)}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1">
            <EditTaskDialog
              task={task}
              dealId={item.dealId}
              onDone={onDone}
              trigger={
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar tarefa">
                  <Pencil size={13} strokeWidth={1.75} />
                </Button>
              }
            />
            <DeleteTaskDialog
              task={task}
              dealId={item.dealId}
              onDone={onDone}
              trigger={
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Excluir tarefa">
                  <Trash2 size={13} strokeWidth={1.75} />
                </Button>
              }
            />
          </div>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <Link href={`/negocios/${item.dealId}`} className="hover:text-foreground hover:underline">
            {item.dealTitle}
          </Link>
          {" · "}
          {item.contactName}
        </p>
        {!isDone && item.type === "mensagem" && (
          <MessageTaskExecutor
            task={task}
            dealId={item.dealId}
            contactId={item.contactId}
            channels={channels}
            preselectedChannelId={preselectedChannelId}
            onDone={onDone}
          />
        )}
        {!isDone && item.type === "agendamento" && (
          <div className="mt-2">
            <SchedulingTaskExecutor
              task={task}
              dealId={item.dealId}
              contactEmail={item.contactEmail}
              isGoogleConnected={isGoogleConnected}
              onDone={onDone}
            />
          </div>
        )}
        {!isDone && item.type !== "mensagem" && item.type !== "agendamento" && (
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

export function TarefasList({
  tasks,
  channels,
  preselectedChannelId,
  isGoogleConnected,
}: {
  tasks: TarefaItem[];
  channels: { id: string; label: string }[];
  preselectedChannelId: string | null;
  isGoogleConnected: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("aberto");
  const [date, setDate] = useState("");

  const filtered = useMemo(() => {
    const now = new Date();
    const list = tasks.filter((t) => {
      const done = t.status === "concluida";
      const overdue = isOverdue(t.dueAt, done, now);
      if (status === "aberto" && done) return false;
      if (status === "atrasada" && !overdue) return false;
      if (status === "concluida" && !done) return false;
      if (date && (!t.dueAt || !isSameLocalDate(t.dueAt, date))) return false;
      return true;
    });
    return list.sort((a, b) => {
      const aOverdue = isOverdue(a.dueAt, a.status === "concluida", now);
      const bOverdue = isOverdue(b.dueAt, b.status === "concluida", now);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });
  }, [tasks, status, date]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select items={STATUS_OPTIONS} value={status} onValueChange={(v) => setStatus(v ?? "aberto")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_OPTIONS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-44"
        />
        {date && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDate("")}>
            Limpar data
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Nenhuma tarefa encontrada"
          description="Ajuste os filtros pra ver outras tarefas."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <TarefaRow
              key={item.id}
              item={item}
              channels={channels}
              preselectedChannelId={preselectedChannelId}
              isGoogleConnected={isGoogleConnected}
              onDone={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
