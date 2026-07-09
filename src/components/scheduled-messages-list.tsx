"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ScheduledMessageItem = {
  id: string;
  content: string;
  scheduledAt: string;
};

function formatScheduledAt(scheduledAt: string): string {
  return new Date(scheduledAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScheduledMessagesList({
  messages,
}: {
  messages: ScheduledMessageItem[];
}) {
  const router = useRouter();
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  if (messages.length === 0) return null;

  async function handleCancel(id: string) {
    setCancelingId(id);
    try {
      await fetch(`/api/messages/schedule/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-dashed border-border p-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Clock size={13} strokeWidth={1.75} />
        Mensagens agendadas ({messages.length})
      </p>
      {messages.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5 text-xs"
        >
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {m.content}
          </span>
          <span className="shrink-0 font-medium">{formatScheduledAt(m.scheduledAt)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Cancelar agendamento"
            disabled={cancelingId === m.id}
            onClick={() => handleCancel(m.id)}
          >
            <X size={13} strokeWidth={1.75} />
          </Button>
        </div>
      ))}
    </div>
  );
}
