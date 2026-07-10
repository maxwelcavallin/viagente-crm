"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScheduleMeetingDialog } from "@/components/schedule-meeting-dialog";
import { completeTaskAction } from "@/app/negocios/actions";

export type TaskLike = {
  id: string;
  title: string;
  type: "mensagem" | "ligacao" | "agendamento" | "generica";
  status: "pendente" | "concluida";
  messagePreview: string | null;
  dueAt: string | null;
};

export function MessageTaskExecutor({
  task,
  dealId,
  contactId,
  channels,
  preselectedChannelId,
  onDone,
}: {
  task: TaskLike;
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

export function SchedulingTaskExecutor({
  task,
  dealId,
  contactEmail,
  isGoogleConnected,
  onDone,
}: {
  task: TaskLike;
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
