"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type: "mensagem_nova" | "tarefa_vencida" | "tarefa_atribuida";
  dealId: string | null;
  taskId: string | null;
  contactId: string | null;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

const POLL_INTERVAL_MS = 20_000;
const PERMISSION_PRIMED_KEY = "notif-permission-primed";

function destinationFor(item: NotificationItem): string | null {
  if (item.type === "mensagem_nova" && item.contactId) {
    return `/atendimento/${item.contactId}`;
  }
  if (item.dealId) return `/negocios/${item.dealId}`;
  return null;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

function fireBrowserNotification(item: NotificationItem, onClick: () => void) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const n = new Notification(item.title, { body: item.body, tag: item.id });
  n.onclick = () => {
    window.focus();
    onClick();
    n.close();
  };
}

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const seenIdsRef = useRef<Set<string> | null>(null);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data: { unreadCount: number; items: NotificationItem[] } = await res.json();

    const isFirstLoad = seenIdsRef.current === null;
    if (!isFirstLoad) {
      const newOnes = data.items.filter((item) => !seenIdsRef.current?.has(item.id));
      for (const item of newOnes) {
        fireBrowserNotification(item, () => {
          const dest = destinationFor(item);
          if (dest) router.push(dest);
        });
      }
    }
    seenIdsRef.current = new Set(data.items.map((item) => item.id));

    setItems(data.items);
    setUnreadCount(data.unreadCount);
  }, [router]);

  useEffect(() => {
    const initial = setTimeout(fetchNotifications, 0);
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  // Prime a permissão de notificação do navegador de forma não intrusiva:
  // um toast explicando o motivo, uma vez por navegador — nunca o prompt
  // nativo direto (ver seção C da Etapa 23).
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(PERMISSION_PRIMED_KEY)) return;
    localStorage.setItem(PERMISSION_PRIMED_KEY, "1");

    toast("Ativar notificações do navegador?", {
      description:
        "Avisamos sobre mensagens novas e tarefas vencidas mesmo com a aba em segundo plano.",
      duration: 15_000,
      action: {
        label: "Ativar",
        onClick: () => {
          Notification.requestPermission();
        },
      },
    });
  }, []);

  async function handleItemClick(item: NotificationItem) {
    if (!item.read) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      fetch(`/api/notifications/${item.id}/read`, { method: "POST" }).catch(() => {});
    }

    const dest = destinationFor(item);
    if (dest) router.push(dest);
  }

  async function handleMarkAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "POST" }).catch(() => {});
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
            <Bell strokeWidth={1.75} />
            {unreadCount > 0 && (
              <Badge
                variant="info"
                className="absolute -right-1 -top-1 h-4.5 min-w-4.5 justify-center rounded-full px-1 text-[10px]"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <PopoverContent side="bottom" align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="gap-1.5">
              <CheckCheck size={14} strokeWidth={1.75} />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell size={40} strokeWidth={1.75} className="text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação ainda</p>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item)}
                className={cn(
                  "flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-muted",
                  !item.read && "bg-status-info/5"
                )}
              >
                {!item.read && (
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-status-info" />
                )}
                <div className={cn("min-w-0 flex-1", item.read && "pl-3.5")}>
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="truncate text-muted-foreground">{item.body}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
