import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { contacts, messages, whatsappChannels } from "@/db/schema";

export function buildChannelFilter(allowedChannelIds: string[]) {
  return allowedChannelIds.length > 0
    ? or(isNull(messages.channelId), inArray(messages.channelId, allowedChannelIds))
    : isNull(messages.channelId);
}

export type ConversationSummary = {
  contactId: string;
  contactName: string;
  contactPhone: string;
  channelId: string | null;
  channelLabel: string | null;
  lastMessageAt: Date;
  lastMessagePreview: string;
  lastMessageDirection: "entrada" | "saida";
};

export async function listConversations(
  allowedChannelIds: string[]
): Promise<ConversationSummary[]> {
  const channelFilter = buildChannelFilter(allowedChannelIds);

  // DISTINCT ON exige que o primeiro ORDER BY seja a própria coluna do
  // agrupamento (contactId); reordenamos por data no JS depois, sobre um
  // conjunto já reduzido a 1 linha por contato.
  const latest = await db
    .selectDistinctOn([messages.contactId], {
      contactId: messages.contactId,
      channelId: messages.channelId,
      content: messages.content,
      type: messages.type,
      createdAt: messages.createdAt,
      direction: messages.direction,
    })
    .from(messages)
    .where(channelFilter)
    .orderBy(messages.contactId, desc(messages.createdAt));

  if (latest.length === 0) return [];

  const contactIds = latest.map((m) => m.contactId);
  const contactRows = await db
    .select({ id: contacts.id, name: contacts.name, phone: contacts.phone })
    .from(contacts)
    .where(inArray(contacts.id, contactIds));
  const contactById = new Map(contactRows.map((c) => [c.id, c]));

  const channelIds = latest
    .map((m) => m.channelId)
    .filter((id): id is string => Boolean(id));
  const channelRows =
    channelIds.length > 0
      ? await db
          .select({ id: whatsappChannels.id, label: whatsappChannels.label })
          .from(whatsappChannels)
          .where(inArray(whatsappChannels.id, channelIds))
      : [];
  const channelById = new Map(channelRows.map((c) => [c.id, c]));

  const summaries: ConversationSummary[] = latest.map((m) => {
    const contact = contactById.get(m.contactId);
    const channel = m.channelId ? channelById.get(m.channelId) : undefined;
    return {
      contactId: m.contactId,
      contactName: contact?.name ?? "Contato",
      contactPhone: contact?.phone ?? "",
      channelId: m.channelId,
      channelLabel: channel?.label ?? null,
      lastMessageAt: m.createdAt,
      lastMessagePreview: m.type === "texto" ? m.content ?? "" : `📎 ${m.type}`,
      lastMessageDirection: m.direction,
    };
  });

  summaries.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  return summaries;
}

export type ThreadMessage = {
  id: string;
  direction: "entrada" | "saida";
  type: "texto" | "imagem" | "audio" | "documento" | "video";
  content: string | null;
  mediaUrl: string | null;
  status: "enviado" | "entregue" | "lido" | "falhou";
  createdAt: Date;
  channelId: string | null;
  channelLabel: string | null;
  dealId: string | null;
};

export async function getThread(
  contactId: string,
  allowedChannelIds: string[]
): Promise<ThreadMessage[]> {
  const channelFilter = buildChannelFilter(allowedChannelIds);
  return db
    .select({
      id: messages.id,
      direction: messages.direction,
      type: messages.type,
      content: messages.content,
      mediaUrl: messages.mediaUrl,
      status: messages.status,
      createdAt: messages.createdAt,
      channelId: messages.channelId,
      channelLabel: whatsappChannels.label,
      dealId: messages.dealId,
    })
    .from(messages)
    .leftJoin(whatsappChannels, eq(messages.channelId, whatsappChannels.id))
    .where(and(eq(messages.contactId, contactId), channelFilter))
    .orderBy(asc(messages.createdAt));
}
