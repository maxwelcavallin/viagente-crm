"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, MessagesSquare, Search, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, initialOf } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/conversations";
import { bulkSetContactOwnerAction } from "@/app/contatos/actions";

const POLL_INTERVAL_MS = 4000;
const ALL_CHANNELS = "__todos__";
const ALL_OWNERS = "__todos__";
const OWNER_MINE = "__meus__";
const OWNER_UNASSIGNED = "__sem_dono__";

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
          initialOf(conversation.contactName)
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
  currentUserId,
  users,
  children,
}: {
  conversations: ConversationSummary[];
  currentUserId: string;
  users: { id: string; name: string }[];
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
  const [ownerFilter, setOwnerFilter] = useState(ALL_OWNERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, setIsBulkPending] = useState(false);

  function toggleSelect(contactId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }

  async function handleBulkSetOwner(ownerId: string | null) {
    setIsBulkPending(true);
    await bulkSetContactOwnerAction(Array.from(selectedIds), ownerId);
    setIsBulkPending(false);
    setSelectedIds(new Set());
    router.refresh();
  }

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
      if (ownerFilter === OWNER_MINE && c.ownerId !== currentUserId) return false;
      else if (ownerFilter === OWNER_UNASSIGNED && c.ownerId !== null) return false;
      else if (
        ownerFilter !== ALL_OWNERS &&
        ownerFilter !== OWNER_MINE &&
        ownerFilter !== OWNER_UNASSIGNED &&
        c.ownerId !== ownerFilter
      )
        return false;
      if (term && !c.contactName.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [conversations, search, channelFilter, kindFilter, ownerFilter, currentUserId]);

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
          <div className="flex items-center gap-2">
            <Select
              items={Object.fromEntries([
                [ALL_OWNERS, "Todos os donos"],
                [OWNER_MINE, "Meus atendimentos"],
                [OWNER_UNASSIGNED, "Não atribuídos"],
                ...users.filter((u) => u.id !== currentUserId).map((u) => [u.id, u.name]),
              ])}
              value={ownerFilter}
              onValueChange={(value) => setOwnerFilter(value ?? ALL_OWNERS)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OWNERS}>Todos os donos</SelectItem>
                <SelectItem value={OWNER_MINE}>Meus atendimentos</SelectItem>
                <SelectItem value={OWNER_UNASSIGNED}>Não atribuídos</SelectItem>
                {users
                  .filter((u) => u.id !== currentUserId)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
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

        {selectedIds.size > 0 && (
          <div className="sticky top-[132px] z-10 flex items-center gap-2 border-b border-primary/40 bg-card p-2">
            <span className="px-1 text-xs font-medium">
              {selectedIds.size} selecionado{selectedIds.size === 1 ? "" : "s"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button type="button" variant="outline" size="sm" disabled={isBulkPending} />}
              >
                Definir dono...
                <ChevronDown size={14} strokeWidth={1.75} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleBulkSetOwner(null)}>
                  Sem dono
                </DropdownMenuItem>
                {users.map((u) => (
                  <DropdownMenuItem key={u.id} onClick={() => handleBulkSetOwner(u.id)}>
                    {u.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Cancelar seleção"
              className="ml-auto"
              onClick={() => setSelectedIds(new Set())}
            >
              <X size={14} strokeWidth={1.75} />
            </Button>
          </div>
        )}

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
              const isSelected = selectedIds.has(conversation.contactId);
              return (
                <li key={conversation.contactId} className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => toggleSelect(conversation.contactId)}
                    aria-label={isSelected ? "Remover da seleção" : "Selecionar atendimento"}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex w-8 shrink-0 items-center justify-center border-b border-border transition-colors hover:bg-muted",
                      isSelected && "bg-accent"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      )}
                    >
                      {isSelected && <Check size={11} strokeWidth={2.5} />}
                    </span>
                  </button>
                  <Link
                    href={`/atendimento/${conversation.contactId}`}
                    className={cn(
                      "flex flex-1 items-start gap-2.5 border-b border-border p-3 hover:bg-accent",
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
