import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduledMessages } from "@/db/schema";

export type PendingScheduledMessage = {
  id: string;
  content: string;
  scheduledAt: Date;
  channelId: string;
};

export async function getPendingScheduledMessages(
  contactId: string
): Promise<PendingScheduledMessage[]> {
  return db
    .select({
      id: scheduledMessages.id,
      content: scheduledMessages.content,
      scheduledAt: scheduledMessages.scheduledAt,
      channelId: scheduledMessages.channelId,
    })
    .from(scheduledMessages)
    .where(
      and(
        eq(scheduledMessages.contactId, contactId),
        eq(scheduledMessages.status, "pendente")
      )
    )
    .orderBy(asc(scheduledMessages.scheduledAt));
}
