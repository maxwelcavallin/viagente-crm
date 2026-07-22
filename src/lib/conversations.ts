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

// Uma "conversa" é o par (contato, canal) — não o contato sozinho: um
// contato pode ter várias conversas separadas (ex: WhatsApp e Instagram),
// igual pode ter vários negócios ou várias notas de reunião. Nunca
// misturamos o histórico de canais diferentes numa única lista de
// mensagens (ver decisão explícita do usuário — antes disso, um contato
// com >1 canal tinha as mensagens intercaladas numa thread só).
export async function listConversations(
  allowedChannelIds: string[],
  currentUser: VisibilityUser
): Promise<ConversationSummary[]> {
  const channelFilter = buildChannelFilter(allowedChannelIds);

  // DISTINCT ON exige que o primeiro ORDER BY seja as próprias colunas do
  // agrupamento (contactId, channelId); reordenamos por data no JS depois,
  // sobre um conjunto já reduzido a 1 linha por (contato, canal). Junta
  // contacts aqui só pra poder aplicar a restrição de visibilidade por dono
  // direto na query.
  const latest = await db
    .selectDistinctOn([messages.contactId, messages.channelId], {
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
    .orderBy(messages.contactId, messages.channelId, desc(messages.createdAt));

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
      markedUnread: contacts.markedUnread,
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
  // equipe, não por usuário (ver markContactRead). Continua por CONTATO
  // (não por canal) de propósito: é uma simplificação deliberada, já que
  // lastReadAt é uma coluna só por contato — abrir qualquer uma das
  // conversas do contato marca todas como lidas por ora.
  const unreadRows = await db
    .select({
      contactId: messages.contactId,
      channelId: messages.channelId,
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
    .groupBy(messages.contactId, messages.channelId);
  const unreadByKey = new Map(
    unreadRows.map((r) => [`${r.contactId}:${r.channelId}`, r.count])
  );

  const summaries: ConversationSummary[] = latest.map((m) => {
    const contact = contactById.get(m.contactId);
    const channel = m.channelId ? channelById.get(m.channelId) : undefined;
    const naturalUnreadCount = unreadByKey.get(`${m.contactId}:${m.channelId}`) ?? 0;
    // markedUnread (marcação manual) garante badge mesmo sem mensagem nova
    // real — nunca reduz uma contagem natural já maior.
    const unreadCount = contact?.markedUnread
      ? Math.max(naturalUnreadCount, 1)
      : naturalUnreadCount;
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
      unreadCount,
      ownerId: contact?.ownerId ?? null,
      ownerName: contact?.ownerName ?? null,
    };
  });

  summaries.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  return summaries;
}

// Marca a conversa como lida pra equipe inteira (inbox compartilhado — ver
// comentário acima). Chamado ao abrir a tela de uma conversa, e também
// limpa a marcação manual de "não lida" (ver markContactUnread).
export async function markContactRead(contactId: string): Promise<void> {
  await db
    .update(contacts)
    .set({ lastReadAt: new Date(), markedUnread: false })
    .where(eq(contacts.id, contactId));
}

// Marcação manual de "não lida" (ação do usuário na lista de conversas,
// sem precisar de mensagem nova) — não mexe em lastReadAt, só liga a flag
// que força o badge; markContactRead desliga de novo ao abrir a conversa.
export async function markContactUnread(contactId: string): Promise<void> {
  await db
    .update(contacts)
    .set({ markedUnread: true })
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
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedScope: "everyone" | "me" | null;
};

// Base compartilhada por getThread e getThreadPage — mesmas colunas/joins,
// só muda o where/orderBy/limit final de cada uma.
function threadBaseQuery() {
  return db
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
      editedAt: messages.editedAt,
      deletedAt: messages.deletedAt,
      deletedScope: messages.deletedScope,
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
    );
}

type ThreadRow = Awaited<ReturnType<typeof threadBaseQuery>>[number];

function mapThreadRow(row: ThreadRow): ThreadMessage {
  const { replyToType, replyToContent, ...rest } = row;
  return {
    ...rest,
    replyTo: rest.replyToMessageId
      ? { type: replyToType!, content: replyToContent }
      : null,
  };
}

function conversationFilterFor(channelId: string | null | undefined) {
  return channelId === undefined
    ? undefined
    : channelId
      ? eq(messages.channelId, channelId)
      : isNull(messages.channelId);
}

// channelId identifica QUAL conversa do contato mostrar (ver comentário em
// listConversations): um id real filtra pra aquele canal só, null filtra só
// mensagens sem canal (raro, mas messages.channel_id é nullable), e
// undefined não filtra por canal — traz tudo junto (usado só pelas telas
// que ainda mostram o histórico mesclado como referência: contato, negócio,
// API pública). allowedChannelIds continua sendo a checagem de
// permissão/visibilidade, independente da conversa escolhida.
export async function getThread(
  contactId: string,
  channelId: string | null | undefined,
  allowedChannelIds: string[]
): Promise<ThreadMessage[]> {
  const channelFilter = buildChannelFilter(allowedChannelIds);
  const rows = await threadBaseQuery()
    .where(and(eq(messages.contactId, contactId), conversationFilterFor(channelId), channelFilter))
    .orderBy(asc(messages.createdAt));

  return rows.map(mapThreadRow);
}

// Últimas N mensagens, em ordem cronológica (mais antiga → mais nova, como
// se lê uma conversa) — usada pelas prévias de conversa em negócio e contato
// (ver conversation-preview-card.tsx), que só mostram um resumo rápido com
// atalho pro Atendimento pro histórico completo, diferente de getThread
// (Atendimento, exportação), que continua trazendo tudo.
export async function getRecentThreadMessages(
  contactId: string,
  channelId: string | null | undefined,
  allowedChannelIds: string[],
  limit = 3
): Promise<ThreadMessage[]> {
  const channelFilter = buildChannelFilter(allowedChannelIds);
  const rows = await threadBaseQuery()
    .where(and(eq(messages.contactId, contactId), conversationFilterFor(channelId), channelFilter))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.reverse().map(mapThreadRow);
}

// Canal da conversa mais recente de um contato — usado como padrão de qual
// conversa abrir quando não vem um ?channel= explícito na URL (ex: link de
// notificação, ou primeira visita). Não é o único critério: o caller ainda
// cai pro canal padrão/primeiro permitido se o contato não tiver nenhuma
// mensagem ainda.
export async function getMostRecentChannelId(
  contactId: string,
  allowedChannelIds: string[]
): Promise<string | null> {
  const channelFilter = buildChannelFilter(allowedChannelIds);
  const [row] = await db
    .select({ channelId: messages.channelId })
    .from(messages)
    .where(and(eq(messages.contactId, contactId), channelFilter))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return row?.channelId ?? null;
}
