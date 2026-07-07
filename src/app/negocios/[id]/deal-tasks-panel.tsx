"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ListTodo, MessageSquare, Phone, CalendarClock } from "lucide-react";
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
import { completeTaskAction } from "../actions";

export type DealTask = {
  id: string;
  title: string;
  type: "mensagem" | "ligacao" | "agendamento" | "generica";
  status: "pendente" | "concluida";
  messagePreview: string | null;
};

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

function TaskRow({
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
  const [isPending, setIsPending] = useState(false);
  const Icon = TYPE_ICON[task.type];
  const isDone = task.status === "concluida";

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
        {!isDone && task.type !== "mensagem" && (
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

export function DealTasksPanel({
  dealId,
  contactId,
  tasks,
  channels,
  preselectedChannelId,
}: {
  dealId: string;
  contactId: string;
  tasks: DealTask[];
  channels: { id: string; label: string }[];
  preselectedChannelId: string | null;
}) {
  const router = useRouter();

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title="Nenhuma tarefa ainda"
        description="Tarefas automáticas aparecem aqui quando o negócio entra numa etapa com tarefas configuradas."
      />
    );
  }

  const pending = tasks.filter((t) => t.status === "pendente");
  const done = tasks.filter((t) => t.status === "concluida");

  return (
    <div className="space-y-2">
      {[...pending, ...done].map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          dealId={dealId}
          contactId={contactId}
          channels={channels}
          preselectedChannelId={preselectedChannelId}
          onDone={() => router.refresh()}
        />
      ))}
    </div>
  );
}
