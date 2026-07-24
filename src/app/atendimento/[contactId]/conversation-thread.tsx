"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Paperclip, Reply, Star, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, initialOf } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageList, replyPreviewLabel } from "@/components/message-list";
import { EmojiPicker } from "@/components/emoji-picker";
import { InsertParamButton, type ContactDealParam } from "@/components/insert-param-button";
import { AudioRecorderButton } from "@/components/audio-recorder-button";
import { ScheduleMessageDialog } from "@/components/schedule-message-dialog";
import {
  ScheduledMessagesList,
  type ScheduledMessageItem,
} from "@/components/scheduled-messages-list";
import { inferMediaKind, uploadAndSendMedia } from "@/lib/upload-media-client";
import type { ThreadMessage } from "@/lib/conversations";
import type { QuickFillMessageTemplate } from "@/lib/templates";
import {
  DuplicateContactBanner,
  type DuplicateContactInfo,
} from "@/components/duplicate-contact-banner";
import { LinkContactDialog, type LinkContactTarget } from "./link-contact-dialog";

const ATTACHMENT_ACCEPT =
  "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip";
// Instagram Messaging só aceita imagem/vídeo/áudio como anexo — sem tipo
// "document" genérico (ver sendInstagramAttachment em instagram-graph.ts).
const INSTAGRAM_ATTACHMENT_ACCEPT = "image/*,video/*,audio/*";

// Altura máxima da caixa de digitação antes de virar scroll interno (~6
// linhas), igual ao comportamento do composer do WhatsApp Web.
const COMPOSER_MAX_HEIGHT = 160;

export function ConversationThread({
  contactId,
  contactName,
  contactPhone,
  instagramUsername,
  isInstagramContact,
  duplicateContact,
  linkTargets,
  isGroup,
  avatarUrl,
  initialMessages,
  channels,
  preselectedChannelId,
  scheduledMessages,
  params,
  messageTemplates,
}: {
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  instagramUsername: string | null;
  isInstagramContact: boolean;
  duplicateContact: DuplicateContactInfo | null;
  linkTargets: LinkContactTarget[];
  isGroup: boolean;
  avatarUrl: string | null;
  initialMessages: ThreadMessage[];
  channels: { id: string; label: string; channelType: "whatsapp" | "instagram" }[];
  preselectedChannelId: string | null;
  scheduledMessages: ScheduledMessageItem[];
  params: ContactDealParam[];
  messageTemplates: QuickFillMessageTemplate[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [channelId, setChannelId] = useState(preselectedChannelId ?? "");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File | Blob;
    fileName?: string;
    previewUrl: string;
    isImage: boolean;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const hasScrolledToBottomRef = useRef(false);

  const selectedChannel = channels.find((c) => c.id === channelId);
  const isInstagramChannel = selectedChannel?.channelType === "instagram";

  // AtendimentoShell dá um router.refresh() a cada 4s pra manter a lista de
  // conversas viva (poll-based) — isso re-renderiza esta página com um
  // "initialMessages" novo (nova referência de array) mesmo quando as
  // mensagens são exatamente as mesmas de antes. Rolar pro fim a cada vez
  // que ISSO acontece é o que fazia a barra "voltar sozinha" enquanto a
  // pessoa tentava ler mensagens antigas — mesmo segurando o scroll, o
  // próximo refresh (até 4s depois) chutava de volta pro fim.
  // Só forçamos o scroll pro fim: (1) na primeira renderização da conversa
  // (abrir a conversa deve mostrar a mensagem mais recente, não o topo), ou
  // (2) quando chega uma mensagem REALMENTE nova (id do último item mudou) e
  // a pessoa já estava perto do fim — nunca quando é só o mesmo conteúdo
  // redesenhado pelo polling, e nunca puxando de volta quem rolou pra cima
  // de propósito pra ler o histórico.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const latestId = initialMessages[initialMessages.length - 1]?.id ?? null;
    const isNewMessage = latestId !== lastMessageIdRef.current;
    lastMessageIdRef.current = latestId;

    if (!hasScrolledToBottomRef.current) {
      hasScrolledToBottomRef.current = true;
      el.scrollTop = el.scrollHeight;
      return;
    }

    if (!isNewMessage) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 150) {
      el.scrollTop = el.scrollHeight;
    }
  }, [initialMessages]);

  // Cresce junto com o texto (estilo WhatsApp Web) até um teto, e depois
  // vira scroll interno em vez de continuar empurrando o resto da tela.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }, [text]);

  function clearPendingAttachment() {
    setPendingAttachment((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }

  async function handleSend() {
    const message = text.trim();
    if (pendingAttachment) {
      await sendMediaFile(pendingAttachment.file, pendingAttachment.fileName, message || undefined);
      clearPendingAttachment();
      return;
    }
    if (!message || !channelId) return;

    setIsSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          channelType: selectedChannel?.channelType ?? "whatsapp",
          contactId,
          message,
          replyToMessageId: replyingTo?.id,
          replyToCreatedAt: replyingTo?.createdAt.toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao enviar mensagem.");
      }
      setText("");
      setReplyingTo(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar mensagem.");
    } finally {
      setIsSending(false);
    }
  }

  async function sendMediaFile(file: File | Blob, fileName?: string, caption?: string) {
    if (!channelId) return;
    const contentType = file.type || "application/octet-stream";
    const kind = inferMediaKind(contentType);
    // Instagram Messaging não tem tipo "document" — ver
    // INSTAGRAM_ATTACHMENT_ACCEPT e sendInstagramAttachment.
    if (isInstagramChannel && kind === "documento") {
      setUploadError("Instagram não suporta esse tipo de arquivo — só imagem, vídeo e áudio.");
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      await uploadAndSendMedia({
        file,
        contentType,
        fileName,
        kind,
        caption,
        channelId,
        contactId,
        replyToMessageId: replyingTo?.id,
        replyToCreatedAt: replyingTo?.createdAt.toISOString(),
      });
      setText("");
      setReplyingTo(null);
      router.refresh();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Falha ao enviar arquivo.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) void sendMediaFile(file, file.name);
  }

  // Print (Ctrl+V) fica em espera igual um anexo comum — dá pra escrever um
  // texto complementando antes de enviar, em vez de disparar a imagem na hora.
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const fileItem = Array.from(e.clipboardData.items).find(
      (item) => item.kind === "file"
    );
    if (!fileItem) return;
    const file = fileItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    clearPendingAttachment();
    setPendingAttachment({
      file,
      fileName: file.name || undefined,
      previewUrl: URL.createObjectURL(file),
      isImage: file.type.startsWith("image/"),
    });
  }

  async function handleAudioRecorded(blob: Blob) {
    await sendMediaFile(blob);
  }

  // Reaproveitado tanto pelo emoji picker quanto pelo botão de inserir
  // parâmetro (nome/email/campos customizados do contato ou negócio).
  function insertText(value: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((t) => t + value);
      return;
    }
    const start = textarea.selectionStart ?? text.length;
    const end = textarea.selectionEnd ?? text.length;
    const next = text.slice(0, start) + value + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + value.length;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Link
            href="/atendimento"
            className="-ml-1 rounded-md p-1 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Voltar pra lista de conversas"
          >
            <ArrowLeft size={20} strokeWidth={1.75} />
          </Link>
          <Avatar>
            {avatarUrl && <AvatarImage src={avatarUrl} alt={contactName} />}
            <AvatarFallback>
              {isGroup ? (
                <Users size={16} strokeWidth={1.75} />
              ) : (
                initialOf(contactName)
              )}
            </AvatarFallback>
          </Avatar>
          <Link href={`/contatos/${contactId}`} className="min-w-0 hover:opacity-80">
            <div className="truncate font-semibold hover:underline">{contactName}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {isGroup ? (
                <>
                  <Users size={12} strokeWidth={1.75} />
                  Grupo
                </>
              ) : instagramUsername ? (
                `@${instagramUsername}`
              ) : (
                contactPhone
              )}
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {isInstagramContact && (
            <LinkContactDialog sourceContactId={contactId} targets={linkTargets} />
          )}
          <button
            type="button"
            onClick={() => setShowFavoritesOnly((v) => !v)}
            aria-pressed={showFavoritesOnly}
            className={cn(
              "flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground",
              showFavoritesOnly && "text-status-warning hover:text-status-warning"
            )}
          >
            <Star
              size={14}
              strokeWidth={1.75}
              fill={showFavoritesOnly ? "currentColor" : "none"}
            />
            Favoritas
          </button>
          <a
            href={`/api/conversations/${contactId}/export?channel=${preselectedChannelId ?? "none"}`}
            className="text-sm text-primary hover:underline"
          >
            Exportar conversa (.md)
          </a>
        </div>
      </div>

      {duplicateContact && (
        <div className="border-b border-border p-3">
          <DuplicateContactBanner contactId={contactId} duplicate={duplicateContact} />
        </div>
      )}

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
        <MessageList
          messages={initialMessages}
          favoritesOnly={showFavoritesOnly}
          onReply={setReplyingTo}
          isGroup={isGroup}
          canEditDelete
        />
      </div>

      <div className="space-y-2 border-t border-border p-4">
        {scheduledMessages.length > 0 && (
          <ScheduledMessagesList messages={scheduledMessages} />
        )}
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você não tem acesso a nenhum canal pra responder este contato.
          </p>
        ) : (
          <>
            {pendingAttachment && (
              <div className="flex items-center gap-2 rounded-md border-l-2 border-primary/60 bg-muted px-2.5 py-1.5 text-xs">
                {pendingAttachment.isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pendingAttachment.previewUrl}
                    alt="Anexo colado"
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <Paperclip size={16} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                )}
                <p className="line-clamp-1 flex-1 text-muted-foreground">
                  {pendingAttachment.fileName ?? "Anexo colado"} — escreva um texto e envie junto
                </p>
                <button
                  type="button"
                  onClick={clearPendingAttachment}
                  aria-label="Remover anexo"
                  className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} strokeWidth={1.75} />
                </button>
              </div>
            )}
            {replyingTo && (
              <div className="flex items-center gap-2 rounded-md border-l-2 border-primary/60 bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                <Reply size={14} strokeWidth={1.75} className="shrink-0" />
                <p className="line-clamp-1 flex-1">
                  {replyPreviewLabel(replyingTo)}
                </p>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  aria-label="Cancelar citação"
                  className="shrink-0 rounded-md p-0.5 hover:text-foreground"
                >
                  <X size={14} strokeWidth={1.75} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Select
                items={Object.fromEntries(channels.map((c) => [c.id, c.label]))}
                value={channelId}
                onValueChange={(value) => {
                  setChannelId(value ?? "");
                  // Cada canal é uma conversa separada (ver conversations.ts)
                  // — trocar o canal aqui troca de conversa, não só o canal
                  // de envio. A página recarrega as mensagens desse canal
                  // (ConversationThread remonta via key={channelId} no
                  // page.tsx).
                  if (value) router.push(`/atendimento/${contactId}?channel=${value}`);
                }}
              >
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
            <div className="flex items-end gap-1">
              <EmojiPicker onSelect={insertText} />
              <InsertParamButton params={params} onSelect={insertText} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Anexar arquivo"
                disabled={isUploading}
                title={isInstagramChannel ? "Instagram só aceita imagem, vídeo e áudio como anexo" : undefined}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={18} strokeWidth={1.75} />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                accept={isInstagramChannel ? INSTAGRAM_ATTACHMENT_ACCEPT : ATTACHMENT_ACCEPT}
                onChange={handleFileChange}
              />
              <AudioRecorderButton
                onRecorded={handleAudioRecorded}
                disabled={isUploading}
              />
              <ScheduleMessageDialog
                contactId={contactId}
                channels={channels}
                defaultChannelId={channelId || preselectedChannelId}
                defaultMessage={text}
                templates={messageTemplates}
                onScheduled={() => setText("")}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Agendar envio"
                  />
                }
                triggerLabel={<Clock size={18} strokeWidth={1.75} />}
              />
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
                onPaste={handlePaste}
                placeholder="Escreva uma mensagem... (Ctrl+V também cola imagens)"
                rows={1}
                style={{ maxHeight: COMPOSER_MAX_HEIGHT }}
                className="min-h-[40px] flex-1 resize-none overflow-y-auto rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
              />
              <Button
                onClick={handleSend}
                disabled={isSending || isUploading || (!text.trim() && !pendingAttachment)}
              >
                {isSending || isUploading ? "Enviando..." : "Enviar"}
              </Button>
            </div>
            {isUploading && (
              <p className="text-xs text-muted-foreground">Enviando anexo...</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
