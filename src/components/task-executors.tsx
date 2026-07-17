"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScheduleMeetingDialog } from "@/components/schedule-meeting-dialog";
import { completeTaskAction } from "@/app/negocios/actions";
import { uploadEmailAttachment } from "@/lib/upload-email-attachment-client";

export type TaskLike = {
  id: string;
  title: string;
  type: "mensagem" | "ligacao" | "agendamento" | "generica" | "email";
  status: "pendente" | "concluida";
  messagePreview: string | null;
  dueAt: string | null;
  emailSubjectPreview?: string | null;
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

export function EmailTaskExecutor({
  task,
  dealId,
  contactId,
  contactEmail,
  onDone,
}: {
  task: TaskLike;
  dealId: string;
  contactId: string;
  contactEmail: string | null;
  onDone: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [to, setTo] = useState(contactEmail ?? "");
  const [subject, setSubject] = useState(task.emailSubjectPreview ?? "");
  const [body, setBody] = useState(task.messagePreview ?? "");
  const [attachments, setAttachments] = useState<{ filename: string; key: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setIsUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const uploaded = await uploadEmailAttachment(file);
        setAttachments((prev) => [...prev, uploaded]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao anexar arquivo.");
    } finally {
      setIsUploading(false);
    }
  }

  function removeAttachment(key: string) {
    setAttachments((prev) => prev.filter((a) => a.key !== key));
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId,
          contactId,
          taskId: task.id,
          to: to.trim(),
          subject: subject.trim(),
          body,
          attachments,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao enviar email.");
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar email.");
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
      <Input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="Destinatário"
        type="email"
        className="h-8 text-sm"
      />
      <Input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Assunto"
        className="h-8 text-sm"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
      />
      {attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((a) => (
            <li
              key={a.key}
              className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs"
            >
              <span className="min-w-0 flex-1 truncate">{a.filename}</span>
              <button
                type="button"
                onClick={() => removeAttachment(a.key)}
                aria-label="Remover anexo"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X size={12} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isSending || !to.trim() || !subject.trim() || !body.trim()}
          onClick={handleSend}
        >
          {isSending ? "Enviando..." : "Enviar e concluir"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={13} strokeWidth={1.75} />
          {isUploading ? "Anexando..." : "Anexar"}
        </Button>
        <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileChange} />
        <Button type="button" size="sm" variant="outline" onClick={() => setExpanded(false)}>
          Cancelar
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
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
