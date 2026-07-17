"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  Bot,
  KeyRound,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Trophy,
  Webhook,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { DealActivityAction, DealActivityEntry, DealActivitySource } from "@/lib/deal-activity-log";

const ACTION_ICON: Record<DealActivityAction, LucideIcon> = {
  criado: Plus,
  editado: Pencil,
  etapa_alterada: ArrowRightLeft,
  tag_adicionada: Tag,
  tag_removida: Tag,
  ganho: Trophy,
  perdido: XCircle,
  excluido: Trash2,
  campo_alterado: Pencil,
};

const ACTION_COLOR: Record<DealActivityAction, "success" | "danger" | "info" | "secondary"> = {
  criado: "info",
  editado: "secondary",
  etapa_alterada: "info",
  tag_adicionada: "success",
  tag_removida: "danger",
  ganho: "success",
  perdido: "danger",
  excluido: "danger",
  campo_alterado: "secondary",
};

function entryLabel(entry: DealActivityEntry): string {
  switch (entry.action) {
    case "criado":
      return "Negócio criado";
    case "ganho":
      return "Marcado como ganho";
    case "perdido":
      return entry.newValue ?? "Marcado como perdido";
    case "excluido":
      return `Negócio excluído${entry.oldValue ? ` (${entry.oldValue})` : ""}`;
    case "tag_adicionada":
      return `Tag adicionada: ${entry.newValue ?? "—"}`;
    case "tag_removida":
      return `Tag removida: ${entry.oldValue ?? "—"}`;
    case "etapa_alterada":
    case "campo_alterado":
    case "editado":
      return `${entry.fieldName ?? "Campo"}: ${entry.oldValue ?? "—"} → ${entry.newValue ?? "—"}`;
  }
}

function sourceLabel(source: DealActivitySource, userName: string | null): string {
  if (source === "automacao") return "Automação";
  if (source === "webhook") return "Webhook";
  if (source === "api") return "API";
  return userName ?? "Usuário";
}

function SourceIcon({ source }: { source: DealActivitySource }) {
  if (source === "automacao") return <Bot size={12} strokeWidth={1.75} />;
  if (source === "webhook") return <Webhook size={12} strokeWidth={1.75} />;
  if (source === "api") return <KeyRound size={12} strokeWidth={1.75} />;
  return null;
}

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function DealActivityLogCard({
  dealId,
  initialItems,
  initialHasMore,
}: {
  dealId: string;
  initialItems: DealActivityEntry[];
  initialHasMore: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (items.length === 0) return;
    setLoading(true);
    const cursor = items[items.length - 1].createdAt;
    const res = await fetch(
      `/api/deals/${dealId}/activity-log?before=${encodeURIComponent(cursor)}`
    );
    setLoading(false);
    if (!res.ok) return;
    const data: { items: DealActivityEntry[]; hasMore: boolean } = await res.json();
    setItems((prev) => [...prev, ...data.items]);
    setHasMore(data.hasMore);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Pencil}
        title="Nenhuma alteração registrada"
        description="Mudanças de etapa, campos, tags e status do negócio aparecem aqui."
      />
    );
  }

  return (
    <div className="space-y-1">
      {items.map((entry) => {
        const Icon = ACTION_ICON[entry.action];
        const color = ACTION_COLOR[entry.action];
        return (
          <div
            key={entry.id}
            className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0"
          >
            <span
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                color === "success" && "bg-status-success/10 text-status-success",
                color === "danger" && "bg-status-danger/10 text-status-danger",
                color === "info" && "bg-status-info/10 text-status-info",
                color === "secondary" && "bg-secondary text-secondary-foreground"
              )}
            >
              <Icon size={14} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm">{entryLabel(entry)}</p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="outline" className="gap-1 font-normal">
                  <SourceIcon source={entry.source} />
                  {sourceLabel(entry.source, entry.userName)}
                </Badge>
                <span>{formatTimestamp(entry.createdAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
      {hasMore && (
        <div className="pt-2 text-center">
          <Button type="button" variant="outline" size="sm" onClick={loadMore} disabled={loading}>
            {loading ? "Carregando..." : "Carregar mais"}
          </Button>
        </div>
      )}
    </div>
  );
}
