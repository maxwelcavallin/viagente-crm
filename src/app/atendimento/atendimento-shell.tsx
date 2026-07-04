"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="flex h-[calc(100vh-65px)]">
      <aside className="w-80 shrink-0 overflow-y-auto border-r">
        {conversations.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhuma conversa ainda.
          </p>
        ) : (
          <ul>
            {conversations.map((conversation) => {
              const isActive = pathname === `/atendimento/${conversation.contactId}`;
              return (
                <li key={conversation.contactId}>
                  <Link
                    href={`/atendimento/${conversation.contactId}`}
                    className={`block border-b p-3 hover:bg-muted ${
                      isActive ? "bg-muted" : ""
                    }`}
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
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
