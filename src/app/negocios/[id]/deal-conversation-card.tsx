"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageList } from "@/components/message-list";
import type { ThreadMessage } from "@/lib/conversations";

// Mensagem chega da API com datas serializadas em string (JSON) — reconverte
// pra Date antes de guardar no state, mesmo formato que o server component
// já entrega na carga inicial (ver ThreadMessage).
type RawThreadMessage = Omit<ThreadMessage, "createdAt" | "replyToCreatedAt"> & {
  createdAt: string;
  replyToCreatedAt: string | null;
};

function toThreadMessage(raw: RawThreadMessage): ThreadMessage {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    replyToCreatedAt: raw.replyToCreatedAt ? new Date(raw.replyToCreatedAt) : null,
  };
}

// Diferente do histórico de alterações (mais recente primeiro, "carregar
// mais" acrescenta no final): aqui a ordem é cronológica (mais antiga →
// mais nova, do jeito que se lê uma conversa), então "carregar mensagens
// anteriores" insere ANTES das que já estão na tela — com ajuste de scroll
// pra manter a leitura no mesmo lugar (senão o conteúdo inserido acima
// empurra tudo pra baixo e a página pula).
export function DealConversationCard({
  dealId,
  initialMessages,
  initialHasMore,
}: {
  dealId: string;
  initialMessages: ThreadMessage[];
  initialHasMore: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const scrollHeightBeforeLoad = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (scrollHeightBeforeLoad.current == null) return;
    const diff = document.documentElement.scrollHeight - scrollHeightBeforeLoad.current;
    window.scrollBy(0, diff);
    scrollHeightBeforeLoad.current = null;
  }, [messages]);

  async function loadMore() {
    if (messages.length === 0) return;
    setLoading(true);
    const cursor = messages[0].createdAt.toISOString();
    const res = await fetch(
      `/api/deals/${dealId}/messages?before=${encodeURIComponent(cursor)}`
    );
    setLoading(false);
    if (!res.ok) return;
    const data: { messages: RawThreadMessage[]; hasMore: boolean } = await res.json();
    scrollHeightBeforeLoad.current = document.documentElement.scrollHeight;
    setMessages((prev) => [...data.messages.map(toThreadMessage), ...prev]);
    setHasMore(data.hasMore);
  }

  return (
    <div className="space-y-3">
      {hasMore && (
        <div className="text-center">
          <Button type="button" variant="outline" size="sm" onClick={loadMore} disabled={loading}>
            {loading ? "Carregando..." : "Carregar mensagens anteriores"}
          </Button>
        </div>
      )}
      <MessageList
        messages={messages}
        emptyMessage="Nenhuma conversa registrada com este contato ainda."
      />
    </div>
  );
}
