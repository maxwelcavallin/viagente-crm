"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { instagramChannelRestrictions } from "@/db/schema";

export async function setChannelAccessAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (session?.user?.role !== "admin") return;

  const channelId = formData.get("channelId");
  const userId = formData.get("userId");
  const hasAccess = formData.get("hasAccess") === "true";
  if (typeof channelId !== "string" || typeof userId !== "string") return;

  if (hasAccess) {
    await db
      .delete(instagramChannelRestrictions)
      .where(
        and(
          eq(instagramChannelRestrictions.userId, userId),
          eq(instagramChannelRestrictions.channelId, channelId)
        )
      );
  } else {
    await db
      .insert(instagramChannelRestrictions)
      .values({ userId, channelId })
      .onConflictDoNothing();
  }

  revalidatePath(`/configuracoes/instagram/${channelId}`);
}
