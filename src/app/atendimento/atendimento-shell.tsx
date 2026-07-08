"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessagesSquare, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/conversations";

const POLL_INTERVAL_MS = 4000;
const ALL_CHANNELS = "__todos__";

type KindFilter = "all" | "group" | "individual";

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function ConversationAvatar({ conversation }: { conversation: ConversationSummary }) {
  return (
    <Avatar>
      {conversation.avatarUrl && (
        <AvatarImage src={conversation.avatarUrl} alt={conversation.contactName} />
      )}
      <AvatarFallback>
        {conversation.isGroup ? (
          <Users size={14} strokeWidth={1.75} />
        ) : (
          conversation.contactName.charAt(0).toUpperCase()
        )}
      </AvatarFallback>
    </Avatar>
  );
}

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "individual", label: "Individuais" },
  { value: "group", label: "Grupos" },
];

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

  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState(ALL_CHANNELS);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  const channelOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of conversations) {
      if (c.channelId && c.channelLabel && !seen.has(c.channelId)) {
        seen.set(c.channelId, c.channelLabel);
      }
    }
    return Array.from(seen, ([id, label]) => ({ id, label }));
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (kindFilter === "group" && !c.isGroup) return false;
      if (kindFilter === "individual" && c.isGroup) return false;
      if (channelFilter !== ALL_CHANNELS && c.channelId !== channelFilter) return false;
      if (term && !c.contactName.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [conversations, search, channelFilter, kindFilter]);

  return (
    <div className="flex h-full">
      <aside
        className={cn(
          "w-full shrink-0 flex-col overflow-y-auto border-r border-border lg:flex lg:w-80",
          isListRoute ? "flex" : "hidden"
        )}
      >
        <div className="sticky top-0 z-10 space-y-2 border-b border-border bg-background p-3">
          <div className="relative">
            <Search
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select
              items={Object.fromEntries([
                [ALL_CHANNELS, "Todos os canais"],
                ...channelOptions.map((c) => [c.id, c.label]),
              ])}
              value={channelFilter}
              onValueChange={(value) => setChannelFilter(value ?? ALL_CHANNELS)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CHANNELS}>Todos os canais</SelectItem>
                {channelOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1">
            {KIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setKindFilter(opt.value)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted",
                  kindFilter === opt.value && "bg-accent text-accent-foreground hover:bg-accent"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {conversations.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="Nenhuma conversa ainda"
            description="Mensagens recebidas via WhatsApp aparecem aqui."
          />
        ) : filteredConversations.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nenhuma conversa encontrada"
            description="Ajuste a busca ou os filtros acima."
          />
        ) : (
          <ul>
            {filteredConversations.map((conversation) => {
              const isActive = pathname === `/atendimento/${conversation.contactId}`;
              const isUnread = conversation.unreadCount > 0;
              const senderPrefix =
                conversation.lastMessageDirection === "saida"
                  ? "Você: "
                  : conversation.isGroup && conversation.lastMessageSenderName
                    ? `${conversation.lastMessageSenderName}: `
                    : "";
              return (
                <li key={conversation.contactId}>
                  <Link
                    href={`/atendimento/${conversation.contactId}`}
                    className={cn(
                      "flex items-start gap-2.5 border-b border-border p-3 hover:bg-accent",
                      isActive && "bg-accent"
                    )}
                  >
                    <ConversationAvatar conversation={conversation} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm",
                            isUnread ? "font-semibold" : "font-medium"
                          )}
                        >
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
                        {conversation.isGroup && (
                          <Users size={12} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                        )}
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-xs text-muted-foreground",
                            isUnread && "font-medium text-foreground"
                          )}
                        >
                          {senderPrefix}
                          {conversation.lastMessagePreview}
                        </span>
                        {isUnread && (
                          <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                            {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                          </span>
                        )}
                      </div>
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
