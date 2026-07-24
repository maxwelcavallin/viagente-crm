"use client";

import { useState, type ReactNode } from "react";
import {
  Check,
  CheckCheck,
  Download,
  Maximize2,
  MoreVertical,
  Pencil,
  Reply,
  Star,
  Trash2,
  TriangleAlert,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initialOf } from "@/lib/utils";
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

// Override local (edição/exclusão) aplicado por cima da mensagem vinda do
// servidor — mesmo padrão do "overrides" de favorito, mas guardando o
// resultado inteiro em vez de só um booleano, já que edição/exclusão mudam
// mais de um campo.
type ContentOverride = {
  content?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  deletedScope?: "everyone" | "me" | null;
};

function EditMessageForm({
  message,
  onSaved,
  onCancel,
}: {
  message: ThreadMessage;
  onSaved: (content: string, editedAt: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(message.content ?? "");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === message.content) {
      onCancel();
      return;
    }
    setIsPending(true);
    setError(null);
    const res = await fetch("/api/messages/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: message.id,
        createdAt: message.createdAt.toISOString(),
        content: trimmed,
      }),
    });
    setIsPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Falha ao editar mensagem.");
      return;
    }
    onSaved(trimmed, new Date().toISOString());
  }

  return (
    <div className="space-y-1.5">
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSave();
          }
          if (e.key === "Escape") onCancel();
        }}
        rows={2}
        className="min-h-[40px] w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Editar mensagem"
      className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      <Pencil size={13} strokeWidth={1.75} />
    </button>
  );
}

function DeleteMessageMenu({
  message,
  onDeleted,
}: {
  message: ThreadMessage;
  onDeleted: (scope: "everyone" | "me", deletedAt: string) => void;
}) {
  async function handleDelete(scope: "everyone" | "me") {
    const res = await fetch("/api/messages/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: message.id,
        createdAt: message.createdAt.toISOString(),
        scope,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Falha ao apagar mensagem.");
      return;
    }
    onDeleted(scope, new Date().toISOString());
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Apagar mensagem"
            className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-destructive"
          />
        }
      >
        <MoreVertical size={13} strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleDelete("me")}>
          <Trash2 size={13} strokeWidth={1.75} />
          Apagar pra mim
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleDelete("everyone")}
          className="text-destructive"
        >
          <Trash2 size={13} strokeWidth={1.75} />
          Apagar pra todos
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
      <p className="line-clamp-2 break-words">{replyPreviewLabel(replyTo)}</p>
    </button>
  );
}

// Formatação estilo WhatsApp: *negrito*, _itálico_ e ~tachado~. Cada marcador
// só é aplicado se tiver o par fechando na mesma linha lógica (sem espaço logo
// depois de abrir/antes de fechar), igual às regras do próprio WhatsApp.
const WHATSAPP_FORMAT_REGEX = /(\*[^*\s](?:[^*]*[^*\s])?\*|_[^_\s](?:[^_]*[^_\s])?_|~[^~\s](?:[^~]*[^~\s])?~)/g;

function renderWhatsappFormatting(text: string): ReactNode[] {
  const parts = text.split(WHATSAPP_FORMAT_REGEX);
  return parts.map((part, index) => {
    if (part.length >= 2) {
      const marker = part[0];
      const inner = part.slice(1, -1);
      if (marker === "*" && part.endsWith("*")) {
        return <strong key={index}>{inner}</strong>;
      }
      if (marker === "_" && part.endsWith("_")) {
        return <em key={index}>{inner}</em>;
      }
      if (marker === "~" && part.endsWith("~")) {
        return <s key={index}>{inner}</s>;
      }
    }
    return part;
  });
}

// Badge de reação estilo WhatsApp — sobrepõe o canto inferior da bolha.
// "reactions" mapeia telefone de quem reagiu -> emoji (ver handleReaction no
// webhook do WhatsApp); mais de uma pessoa pode reagir com emojis diferentes.
function ReactionBadge({ reactions }: { reactions: Record<string, string> }) {
  const emojis = Object.values(reactions);
  if (emojis.length === 0) return null;
  const unique = Array.from(new Set(emojis));
  return (
    <div className="absolute -bottom-2.5 right-1.5 flex items-center gap-0.5 rounded-full border border-border bg-background px-1 py-0.5 text-xs leading-none shadow-sm">
      {unique.slice(0, 3).map((emoji) => (
        <span key={emoji}>{emoji}</span>
      ))}
      {emojis.length > 1 && (
        <span className="text-[10px] text-muted-foreground">{emojis.length}</span>
      )}
    </div>
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

const IMAGE_ZOOM_MIN = 1;
const IMAGE_ZOOM_MAX = 3;
const IMAGE_ZOOM_STEP = 0.5;

function MessageMedia({ message }: { message: ThreadMessage }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  // Mídia que a Z-API falhou em servir (ver comentário em handleIncomingMessage
  // no webhook) ainda grava a mensagem, só sem mediaUrl — sem isso aqui, a
  // bolha ficava totalmente vazia (nem o aviso aparecia).
  if (!message.mediaUrl) {
    return message.content ? (
      <p className="flex items-start gap-1.5 break-words whitespace-pre-wrap text-muted-foreground">
        <TriangleAlert size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        {message.content}
      </p>
    ) : null;
  }

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
        {message.content && (
          <p className="mt-1 break-words whitespace-pre-wrap">
            {renderWhatsappFormatting(message.content)}
          </p>
        )}
        <div className="mt-1">
          <DownloadLink message={message} />
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setZoom(1);
          }}
        >
          <DialogContent className="max-w-[calc(100%-2rem)] gap-3 sm:max-w-4xl">
            <DialogTitle className="sr-only">Imagem ampliada</DialogTitle>
            <div className="max-h-[75vh] w-full overflow-auto rounded-lg bg-black/5 dark:bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.mediaUrl}
                alt="Imagem ampliada"
                onClick={() =>
                  setZoom((z) => (z > IMAGE_ZOOM_MIN ? IMAGE_ZOOM_MIN : 2))
                }
                style={{ transform: `scale(${zoom})` }}
                className={cn(
                  "mx-auto block w-full origin-top object-contain transition-transform",
                  zoom > IMAGE_ZOOM_MIN ? "cursor-zoom-out" : "cursor-zoom-in"
                )}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Diminuir zoom"
                  disabled={zoom <= IMAGE_ZOOM_MIN}
                  onClick={() =>
                    setZoom((z) => Math.max(IMAGE_ZOOM_MIN, +(z - IMAGE_ZOOM_STEP).toFixed(1)))
                  }
                >
                  <ZoomOut size={14} strokeWidth={1.75} />
                </Button>
                <span className="w-10 text-center text-xs text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Aumentar zoom"
                  disabled={zoom >= IMAGE_ZOOM_MAX}
                  onClick={() =>
                    setZoom((z) => Math.min(IMAGE_ZOOM_MAX, +(z + IMAGE_ZOOM_STEP).toFixed(1)))
                  }
                >
                  <ZoomIn size={14} strokeWidth={1.75} />
                </Button>
              </div>
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
        {message.content && (
          <p className="mt-1 break-words whitespace-pre-wrap">
            {renderWhatsappFormatting(message.content)}
          </p>
        )}
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
        className="break-words text-primary underline"
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
  // Editar/apagar só faz sentido no Atendimento (conversa ao vivo) — as
  // prévias mescladas (conversation-preview-card.tsx, em negócio e contato)
  // não passam essa prop, então ficam read-only lá.
  canEditDelete = false,
}: {
  messages: ThreadMessage[];
  emptyMessage?: string;
  favoritesOnly?: boolean;
  onReply?: (message: ThreadMessage) => void;
  isGroup?: boolean;
  canEditDelete?: boolean;
}) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [contentOverrides, setContentOverrides] = useState<Record<string, ContentOverride>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  function isFavorite(message: ThreadMessage): boolean {
    return overrides[message.id] ?? message.isFavorite;
  }

  function handleToggle(id: string, next: boolean) {
    setOverrides((prev) => ({ ...prev, [id]: next }));
  }

  function effectiveMessage(message: ThreadMessage): ThreadMessage {
    const override = contentOverrides[message.id];
    if (!override) return message;
    return {
      ...message,
      content: override.content !== undefined ? override.content : message.content,
      editedAt:
        override.editedAt !== undefined
          ? override.editedAt
            ? new Date(override.editedAt)
            : null
          : message.editedAt,
      deletedAt:
        override.deletedAt !== undefined
          ? override.deletedAt
            ? new Date(override.deletedAt)
            : null
          : message.deletedAt,
      deletedScope:
        override.deletedScope !== undefined ? override.deletedScope : message.deletedScope,
    };
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
      {visibleMessages.map((rawMessage, index) => {
        const message = effectiveMessage(rawMessage);
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
        const isDeleted = Boolean(message.deletedAt);
        const isEditing = editingId === message.id;
        const canEdit =
          canEditDelete && message.direction === "saida" && message.type === "texto" && !isDeleted;
        const canDelete = canEditDelete && message.direction === "saida" && !isDeleted;

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
                {initialOf(message.senderName ?? "?")}
              </AvatarFallback>
            </Avatar>
          )}
          <div
            className={cn(
              "relative min-w-0 rounded-lg px-3 py-2 text-sm",
              isEditing ? "w-full" : "max-w-md",
              message.direction === "saida" ? "bg-accent" : "bg-muted"
            )}
          >
            {showGroupSender && (
              <p className={cn("mb-0.5 text-xs font-semibold", senderColorClass(senderKey))}>
                {message.senderName}
              </p>
            )}
            {isDeleted ? (
              <p className="flex items-center gap-1.5 text-muted-foreground italic">
                <Trash2 size={13} strokeWidth={1.75} className="shrink-0" />
                {message.deletedScope === "me"
                  ? "Você apagou esta mensagem (o contato ainda vê no aparelho dele)."
                  : "Você apagou esta mensagem."}
              </p>
            ) : isEditing ? (
              <EditMessageForm
                message={message}
                onCancel={() => setEditingId(null)}
                onSaved={(content, editedAt) => {
                  setContentOverrides((prev) => ({
                    ...prev,
                    [message.id]: { ...prev[message.id], content, editedAt },
                  }));
                  setEditingId(null);
                }}
              />
            ) : (
              <>
                {message.replyTo && message.replyToMessageId && (
                  <ReplyQuoteCard
                    replyTo={message.replyTo}
                    onClick={() => scrollToMessage(message.replyToMessageId!)}
                  />
                )}
                {message.type === "texto" ? (
                  <p className="break-words whitespace-pre-wrap">
                    {message.content ? renderWhatsappFormatting(message.content) : message.content}
                  </p>
                ) : (
                  <MessageMedia message={message} />
                )}
              </>
            )}
            {!isEditing && (
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                {!isDeleted && (
                  <FavoriteToggle
                    message={message}
                    isFavorite={isFavorite(message)}
                    onToggle={handleToggle}
                  />
                )}
                {!isDeleted && onReply && <ReplyButton onClick={() => onReply(message)} />}
                {canEdit && <EditButton onClick={() => setEditingId(message.id)} />}
                {canDelete && (
                  <DeleteMessageMenu
                    message={message}
                    onDeleted={(scope, deletedAt) => {
                      setContentOverrides((prev) => ({
                        ...prev,
                        [message.id]: { ...prev[message.id], deletedAt, deletedScope: scope },
                      }));
                    }}
                  />
                )}
                {!isDeleted && message.channelLabel && <span>{message.channelLabel}</span>}
                {!isDeleted && message.editedAt && <span>(editado)</span>}
                <span>{formatTimestamp(message.createdAt)}</span>
                {!isDeleted && message.direction === "saida" && (
                  <StatusTick status={message.status} />
                )}
              </div>
            )}
            {!isDeleted && !isEditing && <ReactionBadge reactions={message.reactions} />}
          </div>
        </div>
        );
      })}
    </div>
  );
}
