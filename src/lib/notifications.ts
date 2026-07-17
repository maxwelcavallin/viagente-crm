import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { deals, notifications, tasks } from "@/db/schema";
import { getUsersWithChannelAccess } from "@/lib/channel-access";

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  texto: "",
  imagem: "📷 Imagem",
  audio: "🎤 Áudio",
  documento: "📄 Documento",
  video: "🎥 Vídeo",
};

function messagePreview(type: string, content: string | null): string {
  if (type === "texto") return content?.trim() || "Mensagem recebida";
  return MESSAGE_TYPE_LABELS[type] ?? "Mensagem recebida";
}

// Chamado por handleIncomingMessage no webhook da Z-API (Etapa 5) — uma
// notificação 'mensagem_nova' por usuário com acesso ao canal (respeitando
// whatsapp_channel_restrictions). Notifica sempre, mesmo se o usuário
// estiver com a conversa aberta na tela — ver seção A da Etapa 23 (o
// próprio critério de aceite aceita essa simplificação em vez de rastrear
// "conversa ativa").
export async function notifyNewMessage(params: {
  messageId: string;
  dealId: string | null;
  contactId: string;
  contactName: string;
  channelId: string;
  type: string;
  content: string | null;
}): Promise<void> {
  const userIds = await getUsersWithChannelAccess(params.channelId);
  if (userIds.length === 0) return;

  const body = messagePreview(params.type, params.content);

  await db.insert(notifications).values(
    userIds.map((userId) => ({
      userId,
      type: "mensagem_nova" as const,
      dealId: params.dealId,
      contactId: params.contactId,
      messageId: params.messageId,
      title: params.contactName,
      body,
    }))
  );
}

// Varredura horária (mesmo cron da Etapa 13): tarefas pendentes cujo prazo
// já venceu geram uma notificação 'tarefa_vencida' pro dono do negócio —
// dedupe simples via "já existe notificação desse tipo pra essa task?" em
// vez de uma coluna própria em tasks, não precisa de mais uma migration.
export async function runOverdueTaskNotifications(): Promise<{ notified: number }> {
  const overdue = await db
    .select({
      taskId: tasks.id,
      title: tasks.title,
      dealId: tasks.dealId,
      dealTitle: deals.title,
      ownerId: deals.ownerId,
    })
    .from(tasks)
    .innerJoin(deals, eq(tasks.dealId, deals.id))
    .where(and(eq(tasks.status, "pendente"), lte(tasks.dueAt, new Date())));

  let notified = 0;
  for (const task of overdue) {
    if (!task.ownerId) continue;

    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.taskId, task.taskId), eq(notifications.type, "tarefa_vencida")))
      .limit(1);
    if (existing) continue;

    await db.insert(notifications).values({
      userId: task.ownerId,
      type: "tarefa_vencida",
      dealId: task.dealId,
      taskId: task.taskId,
      title: "Tarefa vencida",
      body: `${task.title} — ${task.dealTitle}`,
    });
    notified += 1;
  }

  return { notified };
}
