"use client";

import { useState } from "react";
import {
  Check,
  CheckCheck,
  Download,
  Maximize2,
  Reply,
  Star,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ThreadMessage } from "@/lib/conversations";

// Paleta fixa pra distinguir participantes de um grupo pelo nome, no estilo
// WhatsApp (cada remetente ganha uma cor consistente, sem exigir cadastro).
const SENDER_COLORS = [
  "text-emerald-600 dark:text-emerald-400",
  "text-blue-600 dark:text-blue-400",
  "text-fuchsia-600 dark:text-fuchsia-400",
  "text-amber-600 dark:text-amber-400",
  "text-cyan-600 dark:text-cyan-400",
  "text-rose-600 dark:text-rose-400",
  "text-indigo-600 dark:text-indigo-400",
  "text-lime-600 dark:text-lime-400",
];

function senderColorClass(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return SENDER_COLORS[hash % SENDER_COLORS.length];
}

async function toggleFavoriteRequest(
  message: ThreadMessage,
  isFavorite: boolean
): Promise<boolean> {
  const res = await fetch("/api/messages/favorite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: message.id,
      createdAt: message.createdAt.toISOString(),
      isFavorite,
    }),
  });
  return res.ok;
}

function FavoriteToggle({
  message,
  isFavorite,
  onToggle,
}: {
  message: ThreadMessage;
  isFavorite: boolean;
  onToggle: (id: string, next: boolean) => void;
}) {
  async function handleClick() {
    const next = !isFavorite;
    onToggle(message.id, next);
    const ok = await toggleFavoriteRequest(message, next);
    if (!ok) onToggle(message.id, !next);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isFavorite ? "Remover dos favoritos" : "Marcar como favorita"}
      aria-pressed={isFavorite}
      className={cn(
        "shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-status-warning",
        isFavorite && "text-status-warning"
      )}
    >
      <Star size={13} strokeWidth={1.75} fill={isFavorite ? "currentColor" : "none"} />
    </button>
  );
}

function ReplyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Responder mensagem"
      className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      <Reply size={13} strokeWidth={1.75} />
    </button>
  );
}

const MEDIA_TYPE_LABELS: Record<
  Exclude<ThreadMessage["type"], "texto">,
  string
> = {
  imagem: "📎 Imagem",
  video: "📎 Vídeo",
  audio: "📎 Áudio",
  documento: "📎 Documento",
};

export function replyPreviewLabel(
  replyTo: Pick<NonNullable<ThreadMessage["replyTo"]>, "type" | "content">
) {
  if (replyTo.type === "texto") return replyTo.content ?? "";
  return MEDIA_TYPE_LABELS[replyTo.type];
}

function ReplyQuoteCard({
  replyTo,
  onClick,
}: {
  replyTo: NonNullable<ThreadMessage["replyTo"]>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 block w-full rounded-md border-l-2 border-primary/60 bg-black/5 px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
    >
      <p className="line-clamp-2">{replyPreviewLabel(replyTo)}</p>
    </button>
  );
}

function scrollToMessage(messageId: string) {
  document
    .getElementById(`message-${messageId}`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Ticks de status no estilo WhatsApp (seção 3 do design system): cinza
// (enviado) → cinza duplo (entregue) → azul --status-info duplo (lido).
// Nunca só a cor — o ícone (check simples/duplo) já diferencia o estado.
function StatusTick({ status }: { status: ThreadMessage["status"] }) {
  if (status === "falhou") {
    return (
      <span className="flex items-center gap-1 text-status-danger">
        <TriangleAlert size={12} strokeWidth={1.75} />
        Falhou
      </span>
    );
  }
  if (status === "lido") {
    return <CheckCheck size={14} strokeWidth={1.75} className="text-status-info" />;
  }
  if (status === "entregue") {
    return <CheckCheck size={14} strokeWidth={1.75} className="opacity-70" />;
  }
  return <Check size={14} strokeWidth={1.75} className="opacity-70" />;
}

// Link de download força Content-Disposition: attachment no proxy
// (/api/media/[messageId]) — sem isso o navegador abre imagem/vídeo inline
// em vez de baixar.
function downloadHref(message: ThreadMessage): string {
  return `${message.mediaUrl}?download=1`;
}

function DownloadLink({
  message,
  className,
}: {
  message: ThreadMessage;
  className?: string;
}) {
  return (
    <a
      href={downloadHref(message)}
      download
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 text-xs text-primary hover:underline ${className ?? ""}`}
    >
      <Download size={12} strokeWidth={1.75} />
      Baixar
    </a>
  );
}

function MessageMedia({ message }: { message: ThreadMessage }) {
  const [open, setOpen] = useState(false);
  if (!message.mediaUrl) return null;

  if (message.type === "imagem") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block cursor-zoom-in overflow-hidden rounded-lg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.mediaUrl}
            alt="Imagem recebida"
            className="max-w-xs rounded-lg transition hover:opacity-90"
          />
        </button>
        <div className="mt-1">
          <DownloadLink message={message} />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[calc(100%-2rem)] gap-3 sm:max-w-2xl">
            <DialogTitle className="sr-only">Imagem ampliada</DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.mediaUrl}
              alt="Imagem ampliada"
              className="max-h-[75vh] w-full rounded-lg object-contain"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                nativeButton={false}
                render={<a href={downloadHref(message)} download />}
              >
                <Download size={14} strokeWidth={1.75} />
                Baixar imagem
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (message.type === "video") {
    return (
      <>
        <div className="group relative w-fit">
          <video
            controls
            src={message.mediaUrl}
            className="max-w-xs rounded-lg"
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ampliar vídeo"
            className="absolute top-2 right-2 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
          >
            <Maximize2 size={14} strokeWidth={1.75} />
          </button>
        </div>
        <div className="mt-1">
          <DownloadLink message={message} />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[calc(100%-2rem)] gap-3 sm:max-w-2xl">
            <DialogTitle className="sr-only">Vídeo ampliado</DialogTitle>
            <video
              controls
              autoPlay
              src={message.mediaUrl}
              className="max-h-[75vh] w-full rounded-lg"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                nativeButton={false}
                render={<a href={downloadHref(message)} download />}
              >
                <Download size={14} strokeWidth={1.75} />
                Baixar vídeo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (message.type === "audio") {
    return (
      <div className="space-y-1">
        <audio controls src={message.mediaUrl} className="max-w-xs" />
        <div>
          <DownloadLink message={message} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={message.mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline"
      >
        📎 Documento
        {message.content ? ` — ${message.content}` : ""}
      </a>
      <DownloadLink message={message} />
    </div>
  );
}

export function MessageList({
  messages,
  emptyMessage = "Nenhuma mensagem visível para você neste contato.",
  favoritesOnly = false,
  onReply,
  isGroup = false,
}: {
  messages: ThreadMessage[];
  emptyMessage?: string;
  favoritesOnly?: boolean;
  onReply?: (message: ThreadMessage) => void;
  isGroup?: boolean;
}) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  function isFavorite(message: ThreadMessage): boolean {
    return overrides[message.id] ?? message.isFavorite;
  }

  function handleToggle(id: string, next: boolean) {
    setOverrides((prev) => ({ ...prev, [id]: next }));
  }

  const visibleMessages = favoritesOnly
    ? messages.filter((m) => isFavorite(m))
    : messages;

  if (visibleMessages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {favoritesOnly
          ? "Nenhuma mensagem favoritada nesta conversa."
          : emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {visibleMessages.map((message, index) => {
        const senderKey = message.senderPhone ?? message.senderName ?? "";
        const previous = index > 0 ? visibleMessages[index - 1] : null;
        const previousSenderKey = previous
          ? (previous.senderPhone ?? previous.senderName ?? "")
          : null;
        const showGroupSender =
          isGroup &&
          message.direction === "entrada" &&
          Boolean(message.senderName) &&
          (previous?.direction !== "entrada" || previousSenderKey !== senderKey);

        return (
        <div
          key={message.id}
          id={`message-${message.id}`}
          className={`flex items-end gap-2 ${message.direction === "saida" ? "justify-end" : "justify-start"}`}
        >
          {isGroup && message.direction === "entrada" && (
            <Avatar size="sm" className={showGroupSender ? "" : "invisible"}>
              {message.senderAvatarUrl && (
                <AvatarImage src={message.senderAvatarUrl} alt={message.senderName ?? ""} />
              )}
              <AvatarFallback>
                {(message.senderName ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <div
            className={`max-w-md rounded-lg px-3 py-2 text-sm ${
              message.direction === "saida" ? "bg-accent" : "bg-muted"
            }`}
          >
            {showGroupSender && (
              <p className={cn("mb-0.5 text-xs font-semibold", senderColorClass(senderKey))}>
                {message.senderName}
              </p>
            )}
            {message.replyTo && message.replyToMessageId && (
              <ReplyQuoteCard
                replyTo={message.replyTo}
                onClick={() => scrollToMessage(message.replyToMessageId!)}
              />
            )}
            {message.type === "texto" ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <MessageMedia message={message} />
            )}
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <FavoriteToggle
                message={message}
                isFavorite={isFavorite(message)}
                onToggle={handleToggle}
              />
              {onReply && <ReplyButton onClick={() => onReply(message)} />}
              {message.channelLabel && <span>{message.channelLabel}</span>}
              <span>{formatTimestamp(message.createdAt)}</span>
              {message.direction === "saida" && (
                <StatusTick status={message.status} />
              )}
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}
