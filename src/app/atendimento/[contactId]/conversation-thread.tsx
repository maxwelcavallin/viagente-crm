"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Paperclip, Reply, Star, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

const ATTACHMENT_ACCEPT =
  "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip";

export function ConversationThread({
  contactId,
  contactName,
  contactPhone,
  isGroup,
  avatarUrl,
  initialMessages,
  channels,
  preselectedChannelId,
  scheduledMessages,
  params,
}: {
  contactId: string;
  contactName: string;
  contactPhone: string;
  isGroup: boolean;
  avatarUrl: string | null;
  initialMessages: ThreadMessage[];
  channels: { id: string; label: string }[];
  preselectedChannelId: string | null;
  scheduledMessages: ScheduledMessageItem[];
  params: ContactDealParam[];
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSend() {
    const message = text.trim();
    if (!message || !channelId) return;

    setIsSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
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

  async function sendMediaFile(file: File | Blob, fileName?: string) {
    if (!channelId) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const contentType = file.type || "application/octet-stream";
      await uploadAndSendMedia({
        file,
        contentType,
        fileName,
        kind: inferMediaKind(contentType),
        channelId,
        contactId,
        replyToMessageId: replyingTo?.id,
        replyToCreatedAt: replyingTo?.createdAt.toISOString(),
      });
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

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const fileItem = Array.from(e.clipboardData.items).find(
      (item) => item.kind === "file"
    );
    if (!fileItem) return;
    const file = fileItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    void sendMediaFile(file, file.name);
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
                contactName.charAt(0).toUpperCase()
              )}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold">{contactName}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {isGroup ? (
                <>
                  <Users size={12} strokeWidth={1.75} />
                  Grupo
                </>
              ) : (
                contactPhone
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
            href={`/api/conversations/${contactId}/export`}
            className="text-sm text-primary hover:underline"
          >
            Exportar conversa (.md)
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <MessageList
          messages={initialMessages}
          favoritesOnly={showFavoritesOnly}
          onReply={setReplyingTo}
          isGroup={isGroup}
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
                onValueChange={(value) => setChannelId(value ?? "")}
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
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={18} strokeWidth={1.75} />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                accept={ATTACHMENT_ACCEPT}
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
                rows={2}
                className="min-h-[40px] flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
              />
              <Button onClick={handleSend} disabled={isSending || !text.trim()}>
                {isSending ? "Enviando..." : "Enviar"}
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
