"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Download, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MessageList } from "@/components/message-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContactChannelPreview } from "@/lib/conversations";

// Mesmo valor usado por /atendimento/[contactId]/page.tsx pra "conversa sem
// canal" (messages.channel_id nulo) — precisa bater pro link "Ver histórico
// completo" abrir a conversa certa, e pro export aceitar o mesmo sentinel
// (ver /api/conversations/[contactId]/export).
const NO_CHANNEL_PARAM = "none";

function channelKey(channelId: string | null): string {
  return channelId ?? NO_CHANNEL_PARAM;
}

// Só uma prévia (últimas mensagens) — histórico completo, com todas as
// ferramentas de conversa ao vivo (favoritar, responder, editar), continua
// só no Atendimento. Aqui é referência rápida com atalho pra lá, separada
// por canal (cada canal é uma conversa distinta, ver conversations.ts) — sem
// isso, contato com WhatsApp + Instagram mostrava as duas conversas
// mescladas numa prévia só.
export function ConversationPreviewCard({
  contactId,
  channels,
}: {
  contactId: string;
  channels: ContactChannelPreview[];
}) {
  const [selectedKey, setSelectedKey] = useState(() =>
    channelKey(channels[0]?.channelId ?? null)
  );

  if (channels.length === 0) {
    return (
      <MessageList
        messages={[]}
        emptyMessage="Nenhuma conversa registrada com este contato ainda."
      />
    );
  }

  const selected =
    channels.find((c) => channelKey(c.channelId) === selectedKey) ?? channels[0];
  const exportHref = `/api/conversations/${contactId}/export?channel=${channelKey(selected.channelId)}`;
  const historyHref = `/atendimento/${contactId}?channel=${channelKey(selected.channelId)}`;

  async function copyConversation() {
    const res = await fetch(exportHref);
    if (!res.ok) {
      toast.error("Falha ao gerar a conversa pra copiar.");
      return;
    }
    const markdown = await res.text();
    await navigator.clipboard.writeText(markdown);
    toast.success("Conversa copiada (.md) pra área de transferência.");
  }

  return (
    <div className="space-y-3">
      {channels.length > 1 && (
        <Select
          items={Object.fromEntries(
            channels.map((c) => [channelKey(c.channelId), c.channelLabel ?? "Sem canal"])
          )}
          value={selectedKey}
          onValueChange={(v) => setSelectedKey(v ?? selectedKey)}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            {channels.map((c) => (
              <SelectItem key={channelKey(c.channelId)} value={channelKey(c.channelId)}>
                {c.channelLabel ?? "Sem canal"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <MessageList
        messages={selected.messages}
        emptyMessage="Nenhuma conversa registrada com este contato ainda."
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={historyHref} />}
        >
          <MessagesSquare size={13} strokeWidth={1.75} />
          Ver histórico completo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={exportHref} />}
        >
          <Download size={13} strokeWidth={1.75} />
          Exportar conversa (.md)
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copyConversation}>
          <Copy size={13} strokeWidth={1.75} />
          Copiar conversa (.md)
        </Button>
      </div>
    </div>
  );
}
