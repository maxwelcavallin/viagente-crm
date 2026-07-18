import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, instagramChannels, messages, users, whatsappChannels } from "@/db/schema";
import { ownerVisibilityFilter, type VisibilityUser } from "@/lib/visibility";

const replyToMessages = alias(messages, "reply_to_messages");

export function buildChannelFilter(allowedChannelIds: string[]) {
  return allowedChannelIds.length > 0
    ? or(isNull(messages.channelId), inArray(messages.channelId, allowedChannelIds))
    : isNull(messages.channelId);
}

export type ConversationSummary = {
  contactId: string;
  contactName: string;
  contactPhone: string;
  instagramUsername: string | null;
  isGroup: boolean;
  avatarUrl: string | null;
  channelId: string | null;
  channelLabel: string | null;
  lastMessageAt: Date;
  lastMessagePreview: string;
  lastMessageDirection: "entrada" | "saida";
  lastMessageSenderName: string | null;
  unreadCount: number;
  ownerId: string | null;
  ownerName: string | null;
};

export async function listConversations(
  allowedChannelIds: string[],
  currentUser: VisibilityUser
): Promise<ConversationSummary[]> {
  const channelFilter = buildChannelFilter(allowedChannelIds);

  // DISTINCT ON exige que o primeiro ORDER BY seja a própria coluna do
  // agrupamento (contactId); reordenamos por data no JS depois, sobre um
  // conjunto já reduzido a 1 linha por contato. Junta contacts aqui só pra
  // poder aplicar a restrição de visibilidade por dono direto na query.
  const latest = await db
    .selectDistinctOn([messages.contactId], {
      contactId: messages.contactId,
      channelId: messages.channelId,
      content: messages.content,
      type: messages.type,
      createdAt: messages.createdAt,
      direction: messages.direction,
      senderName: messages.senderName,
    })
    .from(messages)
    .innerJoin(contacts, eq(contacts.id, messages.contactId))
    .where(and(channelFilter, ownerVisibilityFilter(contacts.ownerId, currentUser)))
    .orderBy(messages.contactId, desc(messages.createdAt));

  if (latest.length === 0) return [];

  const contactIds = latest.map((m) => m.contactId);
  const contactRows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      instagramUsername: contacts.instagramUsername,
      isGroup: contacts.isGroup,
      avatarUrl: contacts.avatarUrl,
      ownerId: contacts.ownerId,
      ownerName: users.name,
    })
    .from(contacts)
    .leftJoin(users, eq(users.id, contacts.ownerId))
    .where(inArray(contacts.id, contactIds));
  const contactById = new Map(contactRows.map((c) => [c.id, c]));

  const channelIds = latest
    .map((m) => m.channelId)
    .filter((id): id is string => Boolean(id));
  // channelId não é FK'd a uma tabela só (mensagem pode ser de um canal
  // WhatsApp OU Instagram, ver Etapa 25) — busca nas duas e junta.
  const [whatsappChannelRows, instagramChannelRows] =
    channelIds.length > 0
      ? await Promise.all([
          db
            .select({ id: whatsappChannels.id, label: whatsappChannels.label })
            .from(whatsappChannels)
            .where(inArray(whatsappChannels.id, channelIds)),
          db
            .select({ id: instagramChannels.id, label: instagramChannels.label })
            .from(instagramChannels)
            .where(inArray(instagramChannels.id, channelIds)),
        ])
      : [[], []];
  const channelById = new Map(
    [...whatsappChannelRows, ...instagramChannelRows].map((c) => [c.id, c])
  );

  // Não lida = mensagem de entrada mais nova que a última leitura registrada
  // pra aquele contato (contacts.lastReadAt) — marca compartilhada por toda a
  // equipe, não por usuário (ver markContactRead).
  const unreadRows = await db
    .select({
      contactId: messages.contactId,
      count: sql<number>`count(*)::int`,
    })
    .from(messages)
    .innerJoin(contacts, eq(contacts.id, messages.contactId))
    .where(
      and(
        eq(messages.direction, "entrada"),
        channelFilter,
        inArray(messages.contactId, contactIds),
        or(isNull(contacts.lastReadAt), gt(messages.createdAt, contacts.lastReadAt))
      )
    )
    .groupBy(messages.contactId);
  const unreadByContact = new Map(unreadRows.map((r) => [r.contactId, r.count]));

  const summaries: ConversationSummary[] = latest.map((m) => {
    const contact = contactById.get(m.contactId);
    const channel = m.channelId ? channelById.get(m.channelId) : undefined;
    return {
      contactId: m.contactId,
      contactName: contact?.name ?? "Contato",
      contactPhone: contact?.phone ?? "",
      instagramUsername: contact?.instagramUsername ?? null,
      isGroup: contact?.isGroup ?? false,
      avatarUrl: contact?.avatarUrl ?? null,
      channelId: m.channelId,
      channelLabel: channel?.label ?? null,
      lastMessageAt: m.createdAt,
      lastMessagePreview: m.type === "texto" ? m.content ?? "" : `📎 ${m.type}`,
      lastMessageDirection: m.direction,
      lastMessageSenderName: m.senderName,
      unreadCount: unreadByContact.get(m.contactId) ?? 0,
      ownerId: contact?.ownerId ?? null,
      ownerName: contact?.ownerName ?? null,
    };
  });

  summaries.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  return summaries;
}

// Marca a conversa como lida pra equipe inteira (inbox compartilhado — ver
// comentário acima). Chamado ao abrir a tela de uma conversa.
export async function markContactRead(contactId: string): Promise<void> {
  await db
    .update(contacts)
    .set({ lastReadAt: new Date() })
    .where(eq(contacts.id, contactId));
}

export type ThreadMessage = {
  id: string;
  direction: "entrada" | "saida";
  type: "texto" | "imagem" | "audio" | "documento" | "video";
  content: string | null;
  mediaUrl: string | null;
  status: "enviado" | "entregue" | "lido" | "falhou";
  isFavorite: boolean;
  createdAt: Date;
  channelId: string | null;
  channelLabel: string | null;
  dealId: string | null;
  replyToMessageId: string | null;
  replyToCreatedAt: Date | null;
  replyTo: {
    type: "texto" | "imagem" | "audio" | "documento" | "video";
    content: string | null;
  } | null;
  senderName: string | null;
  senderPhone: string | null;
  senderAvatarUrl: string | null;
};

export async function getThread(
  contactId: string,
  allowedChannelIds: string[]
): Promise<ThreadMessage[]> {
  const channelFilter = buildChannelFilter(allowedChannelIds);
  const rows = await db
    .select({
      id: messages.id,
      direction: messages.direction,
      type: messages.type,
      content: messages.content,
      mediaUrl: messages.mediaUrl,
      status: messages.status,
      isFavorite: messages.isFavorite,
      createdAt: messages.createdAt,
      channelId: messages.channelId,
      channelLabel: sql<string | null>`coalesce(${whatsappChannels.label}, ${instagramChannels.label})`,
      dealId: messages.dealId,
      replyToMessageId: messages.replyToMessageId,
      replyToCreatedAt: messages.replyToCreatedAt,
      replyToType: replyToMessages.type,
      replyToContent: replyToMessages.content,
      senderName: messages.senderName,
      senderPhone: messages.senderPhone,
      senderAvatarUrl: messages.senderAvatarUrl,
    })
    .from(messages)
    .leftJoin(whatsappChannels, eq(messages.channelId, whatsappChannels.id))
    .leftJoin(instagramChannels, eq(messages.channelId, instagramChannels.id))
    .leftJoin(
      replyToMessages,
      and(
        eq(messages.replyToMessageId, replyToMessages.id),
        eq(messages.replyToCreatedAt, replyToMessages.createdAt)
      )
    )
    .where(and(eq(messages.contactId, contactId), channelFilter))
    .orderBy(asc(messages.createdAt));

  return rows.map(({ replyToType, replyToContent, ...row }) => ({
    ...row,
    replyTo: row.replyToMessageId
      ? { type: replyToType!, content: replyToContent }
      : null,
  }));
}
