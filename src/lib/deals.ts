import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import type { DealMessagePreview } from "@/lib/deal-format";

export async function getLastMessagePreviewsByDealId(
  dealIds: string[]
): Promise<Map<string, DealMessagePreview>> {
  if (dealIds.length === 0) return new Map();

  const rows = await db
    .selectDistinctOn([messages.dealId], {
      dealId: messages.dealId,
      type: messages.type,
      content: messages.content,
      createdAt: messages.createdAt,
      direction: messages.direction,
    })
    .from(messages)
    .where(inArray(messages.dealId, dealIds))
    .orderBy(messages.dealId, desc(messages.createdAt));

  const previewByDealId = new Map<string, DealMessagePreview>();
  for (const row of rows) {
    if (!row.dealId) continue;
    previewByDealId.set(row.dealId, {
      type: row.type,
      content: row.content,
      createdAt: row.createdAt,
      direction: row.direction,
    });
  }
  return previewByDealId;
}
