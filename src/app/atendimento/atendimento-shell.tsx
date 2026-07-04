"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/conversations";

const POLL_INTERVAL_MS = 4000;

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AtendimentoShell({
  conversations,
  children,
}: {
  conversations: ConversationSummary[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Abaixo de `lg`, navegação de duas telas (lista ↔ conversa em tela
  // cheia), no padrão do WhatsApp mobile — ver seção 6 do design system.
  const isListRoute = pathname === "/atendimento";

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="flex h-full">
      <aside
        className={cn(
          "w-full shrink-0 flex-col overflow-y-auto border-r border-border lg:flex lg:w-80",
          isListRoute ? "flex" : "hidden"
        )}
      >
        {conversations.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="Nenhuma conversa ainda"
            description="Mensagens recebidas via WhatsApp aparecem aqui."
          />
        ) : (
          <ul>
            {conversations.map((conversation) => {
              const isActive = pathname === `/atendimento/${conversation.contactId}`;
              return (
                <li key={conversation.contactId}>
                  <Link
                    href={`/atendimento/${conversation.contactId}`}
                    className={cn(
                      "block border-b border-border p-3 hover:bg-accent",
                      isActive && "bg-accent"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {conversation.contactName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatTime(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {conversation.channelLabel && (
                        <Badge variant="secondary">{conversation.channelLabel}</Badge>
                      )}
                      <span className="truncate text-xs text-muted-foreground">
                        {conversation.lastMessageDirection === "saida" ? "Você: " : ""}
                        {conversation.lastMessagePreview}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
      <main
        className={cn(
          "flex-1 overflow-y-auto",
          isListRoute ? "hidden lg:block" : "block"
        )}
      >
        {children}
      </main>
    </div>
  );
}
