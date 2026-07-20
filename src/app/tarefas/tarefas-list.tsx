"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ListTodo, Mail, MessageSquare, Pencil, Phone, CalendarClock, Trash2 } from "lucide-react";
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
import {
  EmailTaskExecutor,
  MessageTaskExecutor,
  SchedulingTaskExecutor,
  type TaskLike,
  type TaskMessageItem,
} from "@/components/task-executors";
import { EditTaskDialog } from "@/components/edit-task-dialog";
import { DeleteTaskDialog } from "@/components/delete-task-dialog";
import { completeTaskAction } from "@/app/negocios/actions";

export type TarefaItem = {
  id: string;
  title: string;
  type: "mensagem" | "ligacao" | "agendamento" | "generica" | "email";
  status: "pendente" | "concluida";
  dueAt: string | null;
  messagePreview: string | null;
  messageItems?: TaskMessageItem[];
  emailSubjectPreview?: string | null;
  dealId: string;
  dealTitle: string;
  dealOwnerId: string | null;
  pipelineId: string;
  pipelineName: string;
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

// Sentinelas pro filtro de dono — nunca colidem com um uuid real.
const OWNER_FILTER_ALL = "todos";
const OWNER_FILTER_MINE = "__meus__";
const OWNER_FILTER_UNASSIGNED = "__sem_dono__";

const ALL_TYPES = "todos";
const TYPE_FILTER_OPTIONS: Record<string, string> = {
  [ALL_TYPES]: "Todos os tipos",
  mensagem: "Mensagem",
  ligacao: "Ligação",
  agendamento: "Agendamento",
  generica: "Genérica",
  email: "Email",
};

const ALL_PIPELINES = "todas";

const TYPE_ICON = {
  mensagem: MessageSquare,
  ligacao: Phone,
  agendamento: CalendarClock,
  generica: ListTodo,
  email: Mail,
} as const;

const TYPE_LABELS: Record<TarefaItem["type"], string> = {
  mensagem: "Mensagem",
  ligacao: "Ligação",
  agendamento: "Agendamento",
  generica: "Genérica",
  email: "Email",
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
    messageItems: item.messageItems,
    dueAt: item.dueAt,
    emailSubjectPreview: item.emailSubjectPreview,
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
          {" · "}
          {item.pipelineName}
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
        {!isDone && item.type === "email" && (
          <div className="mt-2">
            <EmailTaskExecutor
              task={task}
              dealId={item.dealId}
              contactId={item.contactId}
              contactEmail={item.contactEmail}
              onDone={onDone}
            />
          </div>
        )}
        {!isDone &&
          item.type !== "mensagem" &&
          item.type !== "agendamento" &&
          item.type !== "email" && (
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
  currentUserId,
  users,
  pipelines,
}: {
  tasks: TarefaItem[];
  channels: { id: string; label: string }[];
  preselectedChannelId: string | null;
  isGoogleConnected: boolean;
  currentUserId: string;
  users: { id: string; name: string }[];
  pipelines: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState("aberto");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ownerId, setOwnerId] = useState(OWNER_FILTER_ALL);
  const [type, setType] = useState(ALL_TYPES);
  const [pipelineId, setPipelineId] = useState(ALL_PIPELINES);

  const ownerItems: Record<string, string> = useMemo(
    () => ({
      [OWNER_FILTER_ALL]: "Todos os donos",
      [OWNER_FILTER_MINE]: "Minhas tarefas",
      [OWNER_FILTER_UNASSIGNED]: "Não atribuído",
      ...Object.fromEntries(
        users.filter((u) => u.id !== currentUserId).map((u) => [u.id, u.name])
      ),
    }),
    [users, currentUserId]
  );

  const pipelineItems: Record<string, string> = useMemo(
    () => ({
      [ALL_PIPELINES]: "Todas as pipelines",
      ...Object.fromEntries(pipelines.map((p) => [p.id, p.name])),
    }),
    [pipelines]
  );

  const filtered = useMemo(() => {
    const now = new Date();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    const list = tasks.filter((t) => {
      const done = t.status === "concluida";
      const overdue = isOverdue(t.dueAt, done, now);
      if (status === "aberto" && done) return false;
      if (status === "atrasada" && !overdue) return false;
      if (status === "concluida" && !done) return false;
      if (from && (!t.dueAt || new Date(t.dueAt) < from)) return false;
      if (to && (!t.dueAt || new Date(t.dueAt) > to)) return false;
      if (type !== ALL_TYPES && t.type !== type) return false;
      if (pipelineId !== ALL_PIPELINES && t.pipelineId !== pipelineId) return false;
      if (ownerId === OWNER_FILTER_MINE) {
        if (t.dealOwnerId !== currentUserId) return false;
      } else if (ownerId === OWNER_FILTER_UNASSIGNED) {
        if (t.dealOwnerId !== null) return false;
      } else if (ownerId !== OWNER_FILTER_ALL && t.dealOwnerId !== ownerId) {
        return false;
      }
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
  }, [tasks, status, dateFrom, dateTo, type, pipelineId, ownerId, currentUserId]);

  const hasDateFilter = dateFrom || dateTo;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select items={STATUS_OPTIONS} value={status} onValueChange={(v) => setStatus(v ?? "aberto")}>
          <SelectTrigger className="w-40">
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
        <Select items={ownerItems} value={ownerId} onValueChange={(v) => setOwnerId(v ?? OWNER_FILTER_ALL)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ownerItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={TYPE_FILTER_OPTIONS} value={type} onValueChange={(v) => setType(v ?? ALL_TYPES)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_FILTER_OPTIONS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={pipelineItems} value={pipelineId} onValueChange={(v) => setPipelineId(v ?? ALL_PIPELINES)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(pipelineItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36"
            aria-label="Prazo a partir de"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36"
            aria-label="Prazo até"
          />
        </div>
        {hasDateFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
          >
            Limpar datas
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
