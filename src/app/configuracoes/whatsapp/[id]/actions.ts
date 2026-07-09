"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { whatsappChannelRestrictions } from "@/db/schema";

export async function setChannelAccessAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (session?.user?.role !== "admin") return;

  const channelId = formData.get("channelId");
  const userId = formData.get("userId");
  const hasAccess = formData.get("hasAccess") === "true";
  if (typeof channelId !== "string" || typeof userId !== "string") return;

  if (hasAccess) {
    await db
      .delete(whatsappChannelRestrictions)
      .where(
        and(
          eq(whatsappChannelRestrictions.userId, userId),
          eq(whatsappChannelRestrictions.channelId, channelId)
        )
      );
  } else {
    await db
      .insert(whatsappChannelRestrictions)
      .values({ userId, channelId })
      .onConflictDoNothing();
  }

  revalidatePath(`/configuracoes/whatsapp/${channelId}`);
}
