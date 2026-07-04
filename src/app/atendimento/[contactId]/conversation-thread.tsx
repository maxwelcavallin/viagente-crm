"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ThreadMessage } from "@/lib/conversations";

const STATUS_LABEL: Record<ThreadMessage["status"], string> = {
  enviado: "Enviado",
  entregue: "Entregue",
  lido: "Lido",
  falhou: "Falhou",
};

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function MessageMedia({ message }: { message: ThreadMessage }) {
  if (!message.mediaUrl) return null;
  if (message.type === "imagem") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={message.mediaUrl} alt="Imagem recebida" className="max-w-xs rounded-lg" />;
  }
  if (message.type === "audio") {
    return <audio controls src={message.mediaUrl} className="max-w-xs" />;
  }
  return (
    <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="text-primary underline">
      📎 {message.type === "video" ? "Vídeo" : "Documento"}
      {message.content ? ` — ${message.content}` : ""}
    </a>
  );
}

export function ConversationThread({
  contactId,
  contactName,
  contactPhone,
  initialMessages,
  channels,
  preselectedChannelId,
}: {
  contactId: string;
  contactName: string;
  contactPhone: string;
  initialMessages: ThreadMessage[];
  channels: { id: string; label: string }[];
  preselectedChannelId: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [channelId, setChannelId] = useState(preselectedChannelId ?? "");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSend() {
    const message = text.trim();
    if (!message || !channelId) return;

    setIsSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, contactId, message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao enviar mensagem.");
      }
      setText("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar mensagem.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <div className="font-semibold">{contactName}</div>
          <div className="text-xs text-muted-foreground">{contactPhone}</div>
        </div>
        <a
          href={`/api/conversations/${contactId}/export`}
          className="text-sm text-primary hover:underline"
        >
          Exportar conversa (.md)
        </a>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {initialMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma mensagem visível para você neste contato.
          </p>
        ) : (
          initialMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.direction === "saida" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-md rounded-lg px-3 py-2 text-sm ${
                  message.direction === "saida"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.type === "texto" ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <MessageMedia message={message} />
                )}
                <div className="mt-1 flex items-center gap-2 text-xs opacity-70">
                  {message.channelLabel && <span>{message.channelLabel}</span>}
                  <span>{formatTimestamp(message.createdAt)}</span>
                  {message.direction === "saida" && (
                    <span>{STATUS_LABEL[message.status]}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 border-t p-4">
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você não tem acesso a nenhum canal pra responder este contato.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Select value={channelId} onValueChange={(value) => setChannelId(value ?? "")}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Escreva uma mensagem..."
                rows={2}
                className="flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button onClick={handleSend} disabled={isSending || !text.trim()}>
                {isSending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
