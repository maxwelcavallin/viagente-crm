import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import type { DealMessagePreview } from "@/lib/deal-format";

// Por contato, não por negócio: messages.dealId é só um snapshot de "qual
// era o negócio aberto no momento em que a mensagem chegou" (ver
// findOpenDealIdForContact no webhook) — nunca atualizado depois, nem
// preenchido retroativamente num negócio novo criado pro mesmo contato. Um
// negócio recém-criado pra um contato com histórico de conversa ficava sem
// nenhuma mensagem atribuída ao seu próprio id, e o preview no card sumia
// mesmo com a conversa existindo (o link do balão de mensagem já funcionava
// porque esse é por contactId, não por dealId — daí a inconsistência).
export async function getLastMessagePreviewsByContactId(
  contactIds: string[]
): Promise<Map<string, DealMessagePreview>> {
  if (contactIds.length === 0) return new Map();

  const rows = await db
    .selectDistinctOn([messages.contactId], {
      contactId: messages.contactId,
      type: messages.type,
      content: messages.content,
      createdAt: messages.createdAt,
      direction: messages.direction,
    })
    .from(messages)
    .where(inArray(messages.contactId, contactIds))
    .orderBy(messages.contactId, desc(messages.createdAt));

  const previewByContactId = new Map<string, DealMessagePreview>();
  for (const row of rows) {
    previewByContactId.set(row.contactId, {
      type: row.type,
      content: row.content,
      createdAt: row.createdAt,
      direction: row.direction,
    });
  }
  return previewByContactId;
}
