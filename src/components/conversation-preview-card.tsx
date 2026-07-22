"use client";

import Link from "next/link";
import { Copy, Download, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MessageList } from "@/components/message-list";
import type { ThreadMessage } from "@/lib/conversations";

// Só uma prévia (últimas mensagens) — histórico completo, com todas as
// ferramentas de conversa ao vivo (favoritar, responder, editar), continua
// só no Atendimento. Aqui é referência rápida com atalho pra lá.
export function ConversationPreviewCard({
  contactId,
  messages,
  historyHref,
}: {
  contactId: string;
  messages: ThreadMessage[];
  historyHref: string;
}) {
  async function copyConversation() {
    const res = await fetch(`/api/conversations/${contactId}/export`);
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
      <MessageList
        messages={messages}
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
          render={<a href={`/api/conversations/${contactId}/export`} />}
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
