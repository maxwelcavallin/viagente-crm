export type DealMessagePreview = {
  type: "texto" | "imagem" | "audio" | "documento" | "video";
  content: string | null;
  createdAt: Date;
  direction: "entrada" | "saida";
};

export function messagePreviewLabel(preview: DealMessagePreview): string {
  if (preview.type === "texto") return preview.content ?? "";
  const labels: Record<Exclude<DealMessagePreview["type"], "texto">, string> = {
    imagem: "📎 Imagem",
    video: "📎 Vídeo",
    audio: "📎 Áudio",
    documento: "📎 Documento",
  };
  return labels[preview.type];
}

export function formatMessagePreviewDate(createdAt: Date, now: Date = new Date()): string {
  const isSameDay =
    createdAt.getFullYear() === now.getFullYear() &&
    createdAt.getMonth() === now.getMonth() &&
    createdAt.getDate() === now.getDate();
  if (isSameDay) {
    return createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatCurrencyBRL(value: string | null): string | null {
  if (value == null) return null;
  const amount = Number(value);
  if (Number.isNaN(amount)) return null;
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Aproximação do tempo na etapa atual: usa updated_at (não há coluna
// dedicada de "entrou na etapa em"), conforme orientado na Etapa 8.
export function formatTimeInStage(updatedAt: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - updatedAt.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}
