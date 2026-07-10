"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { whatsappChannelRestrictions, whatsappChannels } from "@/db/schema";

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

export type RelayUrlFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idleRelayState: RelayUrlFormState = { status: "idle" };

export async function setChannelRelayUrlAction(
  _prevState: RelayUrlFormState,
  formData: FormData
): Promise<RelayUrlFormState> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { status: "error", message: "Acesso negado." };
  }

  const channelId = formData.get("channelId");
  const relayWebhookUrlRaw = formData.get("relayWebhookUrl");
  if (typeof channelId !== "string" || !channelId) {
    return { status: "error", message: "Canal inválido." };
  }
  const relayWebhookUrl =
    typeof relayWebhookUrlRaw === "string" && relayWebhookUrlRaw.trim()
      ? relayWebhookUrlRaw.trim()
      : null;

  if (relayWebhookUrl) {
    try {
      new URL(relayWebhookUrl);
    } catch {
      return { status: "error", message: "URL inválida." };
    }
  }

  await db
    .update(whatsappChannels)
    .set({ relayWebhookUrl })
    .where(eq(whatsappChannels.id, channelId));

  revalidatePath(`/configuracoes/whatsapp/${channelId}`);
  return idleRelayState;
}
